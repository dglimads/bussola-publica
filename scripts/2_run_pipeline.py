"""
Pipeline completo: extracao -> transformacao -> carga -> (bridges opcionais).

QUANDO RODAR:
  Este e o script principal do projeto. Entrypoint do n8n (diariamente as 06h).
  Se ja tiver dados extraidos em data/raw/, use --apenas-carga para pular a extracao.

O QUE FAZ (em ordem):
  1. Extracao  -- chama a API da Camara e salva JSONs brutos em data/raw/
  2. Transform -- normaliza/limpa os dados com pandas
  3. Carga     -- upsert idempotente no PostgreSQL (Supabase) via SQLAlchemy
  4. Autores   -- (opcional, --with-authors) popula a ponte proposicao<->autor
  5. Votos     -- (opcional, --with-votes)   vincula votacao->proposicao + votos nominais

  O enriquecimento por IA (embedding/tema/resumo) fica em script separado:
  python scripts/3_run_ai_enrichment.py --limite 50

PRE-REQUISITOS:
  - .env configurado com DATABASE_URL (ver .env.example)
  - Banco Supabase com schema aplicado (sql/schema.sql + sql/seeds_temas.sql)
  - Para --with-authors/--with-votes: sql/migration_autoria_votos.sql aplicado

ORDEM TIPICA DE USO:
  # Primeira vez: extrai tudo e carrega
  python scripts/2_run_pipeline.py

  # Uso diario (incremental, apenas ontem) ja com autoria e votos:
  python scripts/2_run_pipeline.py --incremental --with-authors --with-votes

  # So carregar sem extrair (raw ja existe):
  python scripts/2_run_pipeline.py --apenas-carga

  # Backfill com janela maior:
  python scripts/2_run_pipeline.py --dias 30

DESPESAS CEAP:
  NAO sao tratadas aqui. Sao a etapa mais lenta (~500 chamadas HTTP + ~145k
  linhas) e estao fora do escopo do Radar Legislativo. Rode-as por ultimo,
  isoladas, com: python scripts/6_run_despesas.py --ano 2025

Flags:
  --incremental      Extrai apenas ontem (equivalente a --dias 1)
  --dias N           Janela de dias para extracao (default: 1)
  --apenas-carga     Pula a extracao e executa somente transformacao + carga
  --with-authors     Roda o bridge de autoria apos a carga (ponte N:N)
  --with-votes       Roda o bridge de votos nominais apos a carga
  --limit-autores N  Limite de proposicoes no bridge de autoria (default: 500)
  --limit-votos N    Limite de votacoes no bridge de votos (default: 100)
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
        "--apenas-carga",
        action="store_true",
        help="Pula a extracao e executa somente transformacao + carga",
    )
    parser.add_argument(
        "--with-authors",
        action="store_true",
        help="Roda o bridge de autoria (ponte N:N) apos a carga",
    )
    parser.add_argument(
        "--with-votes",
        action="store_true",
        help="Roda o bridge de votos nominais apos a carga",
    )
    parser.add_argument(
        "--limit-autores",
        type=int,
        default=500,
        help="Limite de proposicoes no bridge de autoria (default: 500)",
    )
    parser.add_argument(
        "--limit-votos",
        type=int,
        default=100,
        help="Limite de votacoes no bridge de votos (default: 100)",
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

    # -------------------------------------------------------------------------
    # ETAPA 2+3: Transformacao + Carga (Sprint 2)
    # Lê os JSONs de data/raw/, normaliza com pandas, upserta no PostgreSQL.
    # Ordem de FK: partidos -> deputados -> proposicoes -> votacoes.
    # Despesas CEAP ficam de fora (ver scripts/6_run_despesas.py).
    # -------------------------------------------------------------------------
    log.info("[Carga] Iniciando transform + upsert no banco...")
    from src.load.upsert import get_engine, upsert_all
    engine = get_engine()
    counts = upsert_all(engine)
    log.info("[Carga] Concluida: %s", counts)

    # -------------------------------------------------------------------------
    # ETAPA 4: Bridge de autoria (opcional) -- roadmap pos V1
    # Popula a ponte proposicao<->autor e as flags de autoria.
    # -------------------------------------------------------------------------
    if args.with_authors:
        from src.bridge.autores import run_authors_bridge
        log.info("[Autores] Rodando bridge de autoria (limit=%d)...", args.limit_autores)
        contagem = run_authors_bridge(engine=engine, limit=args.limit_autores, only_missing=True)
        log.info("[Autores] Concluido: %s", contagem)

    # -------------------------------------------------------------------------
    # ETAPA 5: Bridge de votos nominais (opcional) -- roadmap pos V1
    # Vincula votacao->proposicao e popula fato_votacao_votos.
    # -------------------------------------------------------------------------
    if args.with_votes:
        from src.bridge.votos import run_votes_bridge
        log.info("[Votos] Rodando bridge de votos (limit=%d)...", args.limit_votos)
        contagem = run_votes_bridge(engine=engine, limit=args.limit_votos, only_missing=True)
        log.info("[Votos] Concluido: %s", contagem)

    log.info("Pipeline concluido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
