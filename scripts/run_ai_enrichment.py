"""
Enriquecimento com IA das proposicoes legislativas (Sprint 3).

Etapas (em ordem):
  1. embed_pending     -- gera embeddings text-embedding-3-small para ementas
  2. classify_pending  -- classifica proposicoes por tema via similaridade de cosseno
  3. summarize_pending -- gera resumo executivo com gpt-4o-mini

Requer:
  - OPENAI_API_KEY configurada no .env
  - Extensao pgvector habilitada no Supabase (CREATE EXTENSION vector)
  - Proposicoes ja carregadas no banco (run_pipeline.py)

Uso:
  python scripts/run_ai_enrichment.py
  python scripts/run_ai_enrichment.py --limite 50     # limita por etapa
  python scripts/run_ai_enrichment.py --apenas-embed
  python scripts/run_ai_enrichment.py --apenas-classifica
  python scripts/run_ai_enrichment.py --apenas-resume
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import setup_logging

log = setup_logging()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Enriquecimento de IA — Sprint 3")
    p.add_argument("--limite", type=int, default=200,
                   help="Maximo de proposicoes por etapa (default: 200)")
    p.add_argument("--apenas-embed", action="store_true",
                   help="Executa apenas geracao de embeddings")
    p.add_argument("--apenas-classifica", action="store_true",
                   help="Executa apenas classificacao tematica")
    p.add_argument("--apenas-resume", action="store_true",
                   help="Executa apenas geracao de resumos")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    rodar_tudo = not any([args.apenas_embed, args.apenas_classifica, args.apenas_resume])

    from src.load.upsert import get_engine
    from src.ai.embedder import embed_pending
    from src.ai.classifier import classify_pending
    from src.ai.summarizer import summarize_pending

    engine = get_engine()
    counts: dict[str, int] = {}

    if rodar_tudo or args.apenas_embed:
        log.info("[IA 1/3] Gerando embeddings...")
        counts["embeddings"] = embed_pending(engine, limite=args.limite)

    if rodar_tudo or args.apenas_classifica:
        log.info("[IA 2/3] Classificando temas...")
        counts["classificadas"] = classify_pending(engine, limite=args.limite)

    if rodar_tudo or args.apenas_resume:
        log.info("[IA 3/3] Gerando resumos executivos...")
        counts["resumos"] = summarize_pending(engine, limite=args.limite)

    log.info("Enriquecimento concluido: %s", counts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
