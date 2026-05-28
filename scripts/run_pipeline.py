"""
Pipeline completo: extracao -> transformacao -> carga -> IA (Sprint 3).

QUANDO RODAR:
  Este e o script principal do projeto. Entrypoint do n8n (diariamente as 06h).
  Se ja tiver dados extraidos em data/raw/, use --apenas-carga para pular a extracao.

O QUE FAZ (em ordem):
  1. Extracao  -- chama a API da Camara e salva JSONs brutos em data/raw/
  2. Transform -- normaliza/limpa os dados com pandas
  3. Carga     -- upsert idempotente no PostgreSQL (Supabase) via SQLAlchemy
  4. IA        -- Sprint 3: classificacao de tema + embedding (stub por enquanto)

PRE-REQUISITOS:
  - .env configurado com DATABASE_URL (ver .env.example)
  - Banco Supabase com schema aplicado (ver sql/schema.sql + sql/seeds_temas.sql)

ORDEM TIPICA DE USO:
  # Primeira vez: extrai tudo e carrega
  python scripts/run_pipeline.py

  # Uso diario (incremental, apenas ontem):
  python scripts/run_pipeline.py --incremental

  # So carregar sem extrair (raw ja existe):
  python scripts/run_pipeline.py --apenas-carga

  # Backfill com janela maior:
  python scripts/run_pipeline.py --dias 30

  # Pipeline completo incluindo despesas CEAP (lento):
  python scripts/run_pipeline.py --incluir-despesas

Flags:
  --incremental      Extrai apenas ontem (equivalente a --dias 1)
  --dias N           Janela de dias para extracao (default: 1)
  --incluir-despesas Inclui extracao de despesas CEAP (~500 chamadas HTTP)
  --apenas-carga     Pula a extracao e executa somente transformacao + carga
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import setup_logging

log = setup_logging()


def main() -> int:
    parser = argparse.ArgumentParser(description="Pipeline E2E Bussola Publica")
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="Extrai apenas ontem (equivalente a --dias 1)",
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=1,
        help="Janela de dias para extracao (default: 1)",
    )
    parser.add_argument(
        "--incluir-despesas",
        action="store_true",
        help="Inclui extracao de despesas CEAP (~500 chamadas HTTP)",
    )
    parser.add_argument(
        "--apenas-carga",
        action="store_true",
        help="Pula a extracao e executa somente transformacao + carga",
    )
    args = parser.parse_args()

    dias = 1 if args.incremental else args.dias
    data_fim = date.today().isoformat()
    data_inicio = (date.today() - timedelta(days=dias)).isoformat()

    log.info("Pipeline iniciado | janela: %s -> %s", data_inicio, data_fim)

    # -------------------------------------------------------------------------
    # ETAPA 1: Extracao (pular com --apenas-carga)
    # Chama a API e salva JSONs brutos em data/raw/
    # -------------------------------------------------------------------------
    if not args.apenas_carga:
        from src.extract.camara_api import (
            CamaraAPIClient,
            fetch_deputados,
            fetch_partidos,
            fetch_proposicoes,
            fetch_votacoes,
        )
        client = CamaraAPIClient()

        log.info("[Extracao 1/4] Deputados...")
        fetch_deputados(client)

        log.info("[Extracao 2/4] Partidos...")
        fetch_partidos(client)

        log.info("[Extracao 3/4] Proposicoes (janela: %s a %s)...", data_inicio, data_fim)
        fetch_proposicoes(client, data_inicio=data_inicio, data_fim=data_fim)

        log.info("[Extracao 4/4] Votacoes (janela: %s a %s)...", data_inicio, data_fim)
        fetch_votacoes(client, data_inicio=data_inicio, data_fim=data_fim)

        if args.incluir_despesas:
            from src.extract.camara_api import fetch_all_deputados_despesas
            log.info("[Extracao +] Despesas CEAP de todos os deputados...")
            fetch_all_deputados_despesas(client)

    # -------------------------------------------------------------------------
    # ETAPA 2+3: Transformacao + Carga (Sprint 2)
    # Lê os JSONs de data/raw/, normaliza com pandas, upserta no PostgreSQL.
    # Ordem de FK: partidos -> deputados -> proposicoes -> votacoes -> despesas
    # -------------------------------------------------------------------------
    log.info("[Carga] Iniciando transform + upsert no banco...")
    from src.load.upsert import get_engine, upsert_all
    engine = get_engine()
    counts = upsert_all(engine)
    log.info("[Carga] Concluida: %s", counts)

    # -------------------------------------------------------------------------
    # ETAPA 4: IA (Sprint 3 -- a implementar)
    # Classificacao de tema + embeddings + resumo executivo via OpenAI
    # -------------------------------------------------------------------------
    # from src.ai.classifier import classify_pending
    # from src.ai.summarizer  import summarize_pending
    # from src.ai.embedder    import embed_pending
    # classify_pending(engine)
    # summarize_pending(engine)
    # embed_pending(engine)

    log.info("Pipeline concluido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
