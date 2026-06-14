"""
Classificacao tematica de proposicoes por similaridade de cosseno.

Algoritmo:
  1. Busca proposicoes com embedding gerado mas sem tema_id
  2. Carrega embeddings dos temas de dim_temas (gerados on-demand se ausentes)
  3. Calcula similaridade de cosseno entre cada proposicao e cada tema
  4. Atribui o tema de maior similaridade (se score >= THRESHOLD)
  5. Persiste tema_id em fato_proposicoes

Requer que embed_pending() tenha sido executado antes.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

import numpy as np
from dotenv import load_dotenv
from sqlalchemy import Engine, text

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

log = logging.getLogger("bussola.ai.classifier")

THRESHOLD = 0.30


def _get_client() -> Any:
    from openai import OpenAI
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY nao configurada no .env")
    return OpenAI(api_key=key)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def _embed_temas(temas: list[tuple[int, str, str]], client: Any) -> dict[int, list[float]]:
    """Gera embeddings para os temas usando nome + descricao."""
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    textos = [f"{nome}: {desc}" for _, nome, desc in temas]
    resp = client.embeddings.create(model=model, input=textos)
    return {temas[i][0]: item.embedding for i, item in enumerate(resp.data)}


def classify_pending(engine: Engine, limite: int | None = None) -> int:
    """
    Classifica proposicoes com embedding mas sem tema_id.

    Args:
        engine: SQLAlchemy engine conectado ao PostgreSQL.
        limite: Maximo de proposicoes a classificar nesta execucao. None = sem limite.

    Returns:
        Numero de proposicoes classificadas.
    """
    client = _get_client()

    sql_props = """
        SELECT proposicao_id, embedding
        FROM fato_proposicoes
        WHERE embedding IS NOT NULL AND tema_id IS NULL
        ORDER BY proposicao_id
    """
    params: dict = {}
    if limite is not None:
        sql_props += " LIMIT :limite"
        params["limite"] = limite

    with engine.connect() as conn:
        temas_rows = conn.execute(text(
            "SELECT tema_id, nome, descricao FROM dim_temas ORDER BY tema_id"
        )).fetchall()

        prop_rows = conn.execute(text(sql_props), params).fetchall()

    if not prop_rows:
        log.info("Nenhuma proposicao pendente de classificacao.")
        return 0

    if not temas_rows:
        log.warning("dim_temas esta vazia. Execute seeds_temas.sql antes.")
        return 0

    log.info("%d proposicoes para classificar contra %d temas", len(prop_rows), len(temas_rows))

    tema_embeddings = _embed_temas(
        [(r.tema_id, r.nome, r.descricao or r.nome) for r in temas_rows],
        client
    )
    time.sleep(0.3)

    classificadas = 0
    sem_tema = 0

    with engine.begin() as conn:
        for row in prop_rows:
            try:
                emb = row.embedding
                if hasattr(emb, "tolist"):
                    prop_vec = emb.tolist()
                else:
                    prop_vec = [float(x) for x in str(emb).strip("[]").split(",")]
            except Exception:
                continue

            scores = {
                tid: _cosine_similarity(prop_vec, tvec)
                for tid, tvec in tema_embeddings.items()
            }
            best_tid = max(scores, key=lambda k: scores[k])
            best_score = scores[best_tid]

            if best_score >= THRESHOLD:
                conn.execute(
                    text("UPDATE fato_proposicoes SET tema_id = :t WHERE proposicao_id = :p"),
                    {"t": best_tid, "p": row.proposicao_id},
                )
                classificadas += 1
            else:
                sem_tema += 1

    log.info(
        "Classificacao concluida: %d classificadas | %d abaixo do threshold (%.2f)",
        classificadas, sem_tema, THRESHOLD,
    )
    return classificadas
