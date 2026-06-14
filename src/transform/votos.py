"""
Transforma o payload de /votacoes/{id}/votos em registros de fato_votacao_votos.

Mapeamento PURO (sem I/O). A orquestracao fica em src/bridge/votos.py.

Estrutura de cada item de dados[]:
    tipoVoto         -> 'Sim' | 'Nao' | 'Obstrucao' | 'Abstencao' | 'Artigo 17' ...
    dataRegistroVoto -> timestamp ISO
    deputado_        -> { id, nome, siglaPartido, siglaUf, ... }   (note o underscore)

IMPORTANTE: sigla_partido_voto e gravada do payload do VOTO -- representa o
partido no momento da votacao, que pode diferir do partido atual do deputado.
"""
from __future__ import annotations

import logging
from typing import Any

from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.transform")


def map_vote(votacao_id: str, row: dict[str, Any]) -> dict[str, Any]:
    """Mapeia um voto individual da API para um registro de fato_votacao_votos."""
    # A API expoe o objeto do parlamentar em 'deputado_' (com underscore final).
    deputado = row.get("deputado_") or row.get("deputado") or {}
    dep_id = deputado.get("id")

    return {
        "votacao_id": str(votacao_id),
        "deputado_id": int(dep_id) if dep_id is not None else None,
        "tipo_voto": clean_text(safe_str(row.get("tipoVoto"))),
        "sigla_partido_voto": safe_str(deputado.get("siglaPartido")),
        "sigla_uf_voto": safe_str(deputado.get("siglaUf")),
        "data_registro_voto": safe_str(row.get("dataRegistroVoto")),
        "raw_payload": row,
    }


def transform_votos(votacao_id: str, dados: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Converte a lista crua de votos em registros prontos para upsert.

    - Descarta votos sem deputado_id (nao ha como vincular ao parlamentar).
    - Deduplica por deputado_id (chave natural e (votacao_id, deputado_id)).
    """
    registros: list[dict[str, Any]] = []
    vistos: set[int] = set()
    for row in dados or []:
        reg = map_vote(votacao_id, row)
        dep_id = reg["deputado_id"]
        if dep_id is None:
            log.warning("Voto sem deputado_id em votacao %s -- ignorado", votacao_id)
            continue
        if dep_id in vistos:
            continue
        vistos.add(dep_id)
        registros.append(reg)
    return registros
