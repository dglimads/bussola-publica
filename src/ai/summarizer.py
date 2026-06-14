"""
Resumo executivo automatizado de proposicoes legislativas.

Usa gpt-4o-mini com prompt versionado em src/ai/prompts/resumo_executivo.md.
Custo estimado: US$ 0.00015 por proposicao (avg 60 tokens in + 80 tokens out).

Fluxo:
  1. Busca proposicoes sem resumo_executivo
  2. Chama gpt-4o-mini em serie (sem paralelo para respeitar rate limit free tier)
  3. Persiste resumo na coluna resumo_executivo de fato_proposicoes
  4. Registra custo em docs/custo_ia.csv
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

log = logging.getLogger("bussola.ai.summarizer")

PROMPT_PATH = Path(__file__).parent / "prompts" / "resumo_executivo.md"
COST_INPUT_PER_1M = 0.15
COST_OUTPUT_PER_1M = 0.60
SLEEP_BETWEEN_CALLS = 0.5


def _get_client() -> Any:
    from openai import OpenAI
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY nao configurada no .env")
    return OpenAI(api_key=key)


def _load_prompt() -> tuple[str, str]:
    """Retorna (system_prompt, user_template) a partir do arquivo .md."""
    raw = PROMPT_PATH.read_text(encoding="utf-8")
    system, user = "", ""
    section = None
    for line in raw.splitlines():
        if line.strip() == "## System":
            section = "system"
        elif line.strip() == "## User":
            section = "user"
        elif section == "system":
            system += line + "\n"
        elif section == "user":
            user += line + "\n"
    return system.strip(), user.strip()


def _log_cost(tokens_in: int, tokens_out: int) -> None:
    cost = (tokens_in / 1_000_000 * COST_INPUT_PER_1M
            + tokens_out / 1_000_000 * COST_OUTPUT_PER_1M)
    csv_path = PROJECT_ROOT / "docs" / "custo_ia.csv"
    file_exists = csv_path.exists()
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["data", "operacao", "tokens", "custo_usd", "modelo"])
        total = tokens_in + tokens_out
        writer.writerow([date.today(), "summarize_pending", total, f"{cost:.6f}", "gpt-4o-mini"])
    log.info("Custo estimado: US$ %.5f (%d in + %d out tokens)", cost, tokens_in, tokens_out)


def summarize_pending(engine: Engine, limite: int | None = None) -> int:
    """
    Gera resumo executivo para proposicoes sem resumo_executivo.

    Args:
        engine: SQLAlchemy engine conectado ao PostgreSQL.
        limite: Maximo de proposicoes a processar nesta execucao. None = sem limite.

    Returns:
        Numero de proposicoes resumidas.
    """
    client = _get_client()
    model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    system_prompt, user_template = _load_prompt()

    sql = """
        SELECT proposicao_id, tipo, ementa
        FROM fato_proposicoes
        WHERE resumo_executivo IS NULL AND ementa != ''
        ORDER BY data_apresentacao DESC NULLS LAST
    """
    params: dict = {}
    if limite is not None:
        sql += " LIMIT :limite"
        params["limite"] = limite

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()

    if not rows:
        log.info("Nenhuma proposicao pendente de resumo.")
        return 0

    log.info("%d proposicoes para resumir (modelo=%s)", len(rows), model)

    total_in, total_out, resumidas = 0, 0, 0

    for row in rows:
        user_msg = (
            user_template
            .replace("{tipo}", row.tipo or "Proposicao")
            .replace("{ementa}", row.ementa)
        )

        resp = client.chat.completions.create(
            model=model,
            temperature=0.2,
            max_tokens=200,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
        )

        resumo = resp.choices[0].message.content.strip()
        total_in += resp.usage.prompt_tokens
        total_out += resp.usage.completion_tokens

        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE fato_proposicoes SET resumo_executivo = :r WHERE proposicao_id = :p"
                ),
                {"r": resumo, "p": row.proposicao_id},
            )

        resumidas += 1
        time.sleep(SLEEP_BETWEEN_CALLS)

    _log_cost(total_in, total_out)
    log.info("Resumo concluido: %d proposicoes | %d tokens totais", resumidas, total_in + total_out)
    return resumidas
