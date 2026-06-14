"""
Bridge de autoria: popula ponte_proposicao_autores a partir de
/proposicoes/{id}/autores e atualiza as flags de autoria em fato_proposicoes.

Fluxo por proposicao (idempotente, resiliente a falha individual):
    1. fetch_proposicao_autores -> salva raw em data/raw/proposicoes_autores/
    2. transform_autores         -> registros da ponte
    3. upsert_ponte_autores      -> grava (ON CONFLICT)
    4. update_proposicao_autoria_flags -> autores_carregados, qtd, autor principal

Erros (HTTP, JSON, autor sem match) sao logados em pipeline_erros e NAO
interrompem o lote.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from src.extract.camara_api import CamaraAPIClient, fetch_proposicao_autores
from src.load.upsert import (
    get_engine,
    log_pipeline_erro,
    update_proposicao_autoria_flags,
    upsert_ponte_autores,
)
from src.transform.autores import choose_main_author, transform_autores

log = logging.getLogger("bussola.bridge.autores")


def _alvos(
    engine: Engine,
    *,
    limit: int,
    only_missing: bool,
    proposicao_id: int | None,
) -> list[int]:
    """Lista os proposicao_id a processar."""
    if proposicao_id is not None:
        return [int(proposicao_id)]

    # only_missing e o default compartilham o mesmo filtro (retomar de onde parou).
    # A flag existe para deixar a intencao explicita na linha de comando.
    _ = only_missing
    sql = text(
        "SELECT proposicao_id FROM fato_proposicoes "
        "WHERE NOT autores_carregados "
        "ORDER BY proposicao_id DESC "
        "LIMIT :lim"
    )
    with engine.connect() as conn:
        return [int(r.proposicao_id) for r in conn.execute(sql, {"lim": limit})]


def _deputados_conhecidos(engine: Engine) -> set[int]:
    """Set de deputado_id presentes em dim_deputados (para detectar autores orfaos)."""
    with engine.connect() as conn:
        return {int(r.deputado_id) for r in conn.execute(text("SELECT deputado_id FROM dim_deputados"))}


def run_authors_bridge(
    *,
    engine: Engine | None = None,
    client: CamaraAPIClient | None = None,
    limit: int = 500,
    only_missing: bool = False,
    proposicao_id: int | None = None,
    delay_seconds: float = 0.2,
) -> dict[str, int]:
    """
    Executa o bridge de autoria.

    Args:
        limit:         maximo de proposicoes a processar quando nao ha id fixo.
        only_missing:  processa apenas proposicoes sem autores carregados (default ja faz isso).
        proposicao_id: processa uma unica proposicao (reprocessa mesmo se ja carregada).
        delay_seconds: pausa entre chamadas HTTP (gentileza com a API publica).

    Returns:
        Dict com contagens: alvos, processadas, com_autores, sem_autores,
        autores_inseridos, autores_orfaos, erros.
    """
    engine = engine or get_engine()
    client = client or CamaraAPIClient()

    ids = _alvos(engine, limit=limit, only_missing=only_missing, proposicao_id=proposicao_id)
    deputados = _deputados_conhecidos(engine)

    contagem = {
        "alvos": len(ids),
        "processadas": 0,
        "com_autores": 0,
        "sem_autores": 0,
        "autores_inseridos": 0,
        "autores_orfaos": 0,
        "erros": 0,
    }
    log.info("Bridge de autoria: %d proposicao(oes) alvo", len(ids))

    for i, pid in enumerate(ids, 1):
        try:
            path = fetch_proposicao_autores(client, proposicao_id=pid)
            envelope = json.loads(path.read_text(encoding="utf-8", errors="replace"))
            dados: list[dict[str, Any]] = envelope.get("dados", [])

            registros = transform_autores(pid, dados)
            if registros:
                contagem["autores_inseridos"] += upsert_ponte_autores(registros, engine)
                contagem["com_autores"] += 1
            else:
                contagem["sem_autores"] += 1
                log_pipeline_erro(
                    engine, "autores",
                    entidade_tipo="proposicao", entidade_id=pid,
                    mensagem="API nao retornou autores para a proposicao",
                )

            principal = choose_main_author(registros)
            update_proposicao_autoria_flags(engine, pid, len(registros), principal)

            # Autores tipo Deputado que nao existem em dim_deputados (legislatura
            # anterior, p.ex.) -- registra como divergencia, sem bloquear.
            for r in registros:
                if r["deputado_id"] is not None and r["deputado_id"] not in deputados:
                    contagem["autores_orfaos"] += 1
                    log_pipeline_erro(
                        engine, "autores",
                        entidade_tipo="autor", entidade_id=r["deputado_id"],
                        mensagem=f"Deputado autor sem correspondencia em dim_deputados (prop {pid})",
                    )

            contagem["processadas"] += 1
        except Exception as exc:  # resiliencia: falha de um item nao derruba o lote
            contagem["erros"] += 1
            log.warning("Falha ao processar autores da proposicao %s: %s", pid, exc)
            log_pipeline_erro(
                engine, "autores",
                entidade_tipo="proposicao", entidade_id=pid, mensagem=str(exc),
            )

        if i % 50 == 0:
            log.info("  ... %d/%d proposicoes | %s", i, len(ids), contagem)
        if delay_seconds > 0 and i < len(ids):
            time.sleep(delay_seconds)

    log.info("Bridge de autoria concluido: %s", contagem)
    return contagem
