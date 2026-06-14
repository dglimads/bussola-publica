"""
Geracao e persistencia de embeddings para proposicoes legislativas.

Usa text-embedding-3-small da OpenAI (1536 dimensoes, US$ 0.02/1M tokens).
Salva o vetor na coluna `embedding` de fato_proposicoes (tipo VECTOR(1536)).

Fluxo:
  1. Busca proposicoes sem embedding (embedding IS NULL)
  2. Envia ementas em lotes para a API de embeddings
  3. Persiste os vetores no banco via pgvector
  4. Registra custo estimado em docs/custo_ia.csv
"""
from __future__ import annotations

import csv
import logging
import os
import time
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import Engine, text

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

log = logging.getLogger("bussola.ai.embedder")

BATCH_SIZE = 50
COST_PER_1M_TOKENS = 0.02
AVG_TOKENS_PER_EMENTA = 60


def _get_client() -> Any:
    from openai import OpenAI
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY nao configurada no .env")
    return OpenAI(api_key=key)


def _log_cost(tokens: int, operation: str) -> None:
    cost = tokens / 1_000_000 * COST_PER_1M_TOKENS
    csv_path = PROJECT_ROOT / "docs" / "custo_ia.csv"
    file_exists = csv_path.exists()
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["data", "operacao", "tokens", "custo_usd", "modelo"])
        writer.writerow([date.today(), operation, tokens, f"{cost:.6f}", "text-embedding-3-small"])
    log.info("Custo estimado: US$ %.4f (%d tokens)", cost, tokens)


def embed_pending(engine: Engine, limite: int | None = None) -> int:
    """
    Gera embeddings para proposicoes sem embedding e persiste no banco.

    Args:
        engine: SQLAlchemy engine conectado ao PostgreSQL.
        limite: Maximo de proposicoes a processar nesta execucao. None = sem limite.

    Returns:
        Numero de proposicoes com embedding gerado.
    """
    client = _get_client()
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    sql = """
        SELECT proposicao_id, tipo, ementa
        FROM fato_proposicoes
        WHERE embedding IS NULL AND ementa != ''
        ORDER BY proposicao_id
    """
    params: dict = {}
    if limite is not None:
        sql += " LIMIT :limite"
        params["limite"] = limite

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()

    if not rows:
        log.info("Nenhuma proposicao pendente de embedding.")
        return 0

    log.info("%d proposicoes para embeddar (modelo=%s)", len(rows), model)

    total_tokens = 0
    processadas = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i: i + BATCH_SIZE]
        textos = [f"{r.tipo}: {r.ementa}" for r in batch]
        ids = [r.proposicao_id for r in batch]

        try:
            resp = client.embeddings.create(model=model, input=textos)
        except Exception as exc:
            log.error("Erro na API OpenAI: %s", exc)
            log.warning("Verifique billing em platform.openai.com e tente novamente.")
            break
        total_tokens += resp.usage.total_tokens

        vetores = [item.embedding for item in resp.data]

        # pgvector espera string '[0.1, 0.2, ...]' — embutido direto para evitar
        # conflito de ':v::vector' com o parser de bind params do SQLAlchemy
        with engine.begin() as conn:
            for pid, vetor in zip(ids, vetores):
                vec_str = "[" + ",".join(f"{v:.8f}" for v in vetor) + "]"
                conn.execute(
                    text(
                        f"UPDATE fato_proposicoes SET embedding = '{vec_str}'::vector"
                        " WHERE proposicao_id = :id"
                    ),
                    {"id": pid},
                )

        processadas += len(batch)
        log.info("Lote %d/%d — %d embeddings persistidos", i // BATCH_SIZE + 1,
                 -(-len(rows) // BATCH_SIZE), len(batch))
        time.sleep(0.5)

    _log_cost(total_tokens, "embed_pending")
    log.info("Embedding concluido: %d proposicoes | %d tokens", processadas, total_tokens)
    return processadas
