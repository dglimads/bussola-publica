"""
Bridge de votos nominais: vincula votacao -> proposicao e popula
fato_votacao_votos a partir de /votacoes/{id}/votos.

Fluxo por votacao (idempotente, resiliente a falha individual):
    1. fetch_votacao_detalhe -> tenta resolver proposicao_id/uri/objeto (best-effort)
    2. update_votacao_proposicao -> grava o vinculo (so seta FK se a proposicao existe)
    3. fetch_votacao_votos -> salva raw em data/raw/votacoes_votos/
    4. transform_votos / upsert_votos -> grava votos (ON CONFLICT)
    5. update_votacao_votos_flags -> votos_carregados, qtd_votos

Votacoes simbolicas costumam retornar lista de votos vazia -- isso e normal e
nao e tratado como erro.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from src.extract.camara_api import (
    CamaraAPIClient,
    fetch_votacao_detalhe,
    fetch_votacao_votos,
)
from src.load.upsert import (
    get_engine,
    log_pipeline_erro,
    update_votacao_proposicao,
    update_votacao_votos_flags,
    upsert_votos,
)
from src.transform.autores import extract_numeric_id_from_uri
from src.transform.votos import transform_votos
from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.bridge.votos")


def _alvos(
    engine: Engine,
    *,
    limit: int,
    only_missing: bool,
    votacao_id: str | None,
) -> list[str]:
    """Lista os votacao_id a processar (mais recentes primeiro)."""
    if votacao_id is not None:
        return [str(votacao_id)]
    _ = only_missing  # default ja filtra os faltantes; flag deixa a intencao explicita
    sql = text(
        "SELECT votacao_id FROM fato_votacoes "
        "WHERE NOT votos_carregados "
        "ORDER BY data DESC "
        "LIMIT :lim"
    )
    with engine.connect() as conn:
        return [str(r.votacao_id) for r in conn.execute(sql, {"lim": limit})]


def _extrai_vinculo_proposicao(detalhe: dict[str, Any]) -> dict[str, Any]:
    """
    Extrai (best-effort) o vinculo votacao->proposicao do detalhe de /votacoes/{id}.

    A API nem sempre expoe os mesmos campos; tentamos, em ordem:
      1. campos diretos (idProposicao / uriProposicaoObjeto);
      2. primeiro item de proposicoesAfetadas;
      3. id numerico extraido da uri.
    """
    prop_id = detalhe.get("idProposicao")
    uri_prop = safe_str(detalhe.get("uriProposicaoObjeto") or detalhe.get("uriProposicao"))

    afetadas = detalhe.get("proposicoesAfetadas") or []
    if not prop_id and afetadas:
        prop_id = afetadas[0].get("id")
        uri_prop = uri_prop or safe_str(afetadas[0].get("uri"))

    if not prop_id and uri_prop:
        prop_id = extract_numeric_id_from_uri(uri_prop)

    return {
        "proposicao_id": int(prop_id) if prop_id else None,
        "uri_proposicao": uri_prop,
        "objeto_votacao": clean_text(safe_str(detalhe.get("objetoVotacao") or detalhe.get("descricao"))),
        "cod_tipo_votacao": detalhe.get("codTipoVotacao"),
    }


def run_votes_bridge(
    *,
    engine: Engine | None = None,
    client: CamaraAPIClient | None = None,
    limit: int = 100,
    only_missing: bool = False,
    votacao_id: str | None = None,
    delay_seconds: float = 0.2,
) -> dict[str, int]:
    """
    Executa o bridge de votos nominais.

    Args:
        limit:         maximo de votacoes a processar quando nao ha id fixo.
        only_missing:  processa apenas votacoes sem votos carregados (default ja faz isso).
        votacao_id:    processa uma unica votacao (id alfanumerico, ex: '2265603-49').
        delay_seconds: pausa entre chamadas HTTP.

    Returns:
        Dict com contagens: alvos, processadas, com_votos, sem_votos,
        votos_inseridos, vinculadas, erros.
    """
    engine = engine or get_engine()
    client = client or CamaraAPIClient()

    ids = _alvos(engine, limit=limit, only_missing=only_missing, votacao_id=votacao_id)

    contagem = {
        "alvos": len(ids),
        "processadas": 0,
        "com_votos": 0,
        "sem_votos": 0,
        "votos_inseridos": 0,
        "vinculadas": 0,
        "erros": 0,
    }
    log.info("Bridge de votos: %d votacao(oes) alvo", len(ids))

    for i, vid in enumerate(ids, 1):
        try:
            # 1+2. Vinculo votacao -> proposicao (best-effort, nao fatal se falhar)
            try:
                path_det = fetch_votacao_detalhe(client, votacao_id=vid)
                detalhe = json.loads(path_det.read_text(encoding="utf-8", errors="replace")).get("dados", {})
                if isinstance(detalhe, list):  # algumas respostas vem como lista de 1
                    detalhe = detalhe[0] if detalhe else {}
                vinc = _extrai_vinculo_proposicao(detalhe or {})
                update_votacao_proposicao(engine, vid, **vinc)
                if vinc["proposicao_id"]:
                    contagem["vinculadas"] += 1
            except Exception as exc:
                log.warning("Falha ao vincular proposicao da votacao %s: %s", vid, exc)
                log_pipeline_erro(
                    engine, "vinculo_votacao",
                    entidade_tipo="votacao", entidade_id=vid, mensagem=str(exc),
                )

            # 3+4. Votos nominais
            path_votos = fetch_votacao_votos(client, votacao_id=vid)
            dados: list[dict[str, Any]] = json.loads(
                path_votos.read_text(encoding="utf-8", errors="replace")
            ).get("dados", [])

            registros = transform_votos(vid, dados)
            if registros:
                contagem["votos_inseridos"] += upsert_votos(registros, engine)
                contagem["com_votos"] += 1
            else:
                contagem["sem_votos"] += 1  # votacao simbolica/sem votos nominais (normal)

            # 5. Flags
            update_votacao_votos_flags(engine, vid, len(registros))
            contagem["processadas"] += 1
        except Exception as exc:  # resiliencia: falha de um item nao derruba o lote
            contagem["erros"] += 1
            log.warning("Falha ao processar votos da votacao %s: %s", vid, exc)
            log_pipeline_erro(
                engine, "votos",
                entidade_tipo="votacao", entidade_id=vid, mensagem=str(exc),
            )

        if i % 25 == 0:
            log.info("  ... %d/%d votacoes | %s", i, len(ids), contagem)
        if delay_seconds > 0 and i < len(ids):
            time.sleep(delay_seconds)

    log.info("Bridge de votos concluido: %s", contagem)
    return contagem
