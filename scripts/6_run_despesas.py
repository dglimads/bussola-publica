"""
Etapa 6 (ultima): pipeline ISOLADO das despesas CEAP.

POR QUE SEPARADO:
  As despesas CEAP sao a etapa MAIS LENTA do projeto (~500 chamadas HTTP na
  extracao + ~145k linhas na carga) e NAO fazem parte do escopo do Radar
  Legislativo (Data Challenge Xperiun). Para nao travar o ciclo diario de
  proposicoes/votacoes/autoria/votos, elas vivem neste script a parte, pensado
  para rodar POR ULTIMO, depois dos scripts 1 a 5.

O QUE FAZ (autossuficiente):
  1. Extracao  -- fetch_all_deputados_despesas: 1 chamada por deputado (~500)
  2. Transform -- normaliza os JSONs de data/raw/deputados_despesas/
  3. Carga     -- upsert idempotente em fato_despesas (lotes de 500)

QUANDO RODAR:
  Depois que o pipeline principal ja rodou (scripts 1-5). Idempotente: pode
  reexecutar sem duplicar (chave natural (cod_documento, parcela)).

ORDEM TIPICA DE USO:
  python scripts/2_run_pipeline.py --with-authors --with-votes  # nucleo
  python scripts/3_run_ai_enrichment.py --limite 100            # IA
  python scripts/6_run_despesas.py --ano 2025                   # despesas (lento)

Flags:
  --ano N            Ano fiscal das despesas (default: ultimos 6 meses da API)
  --mes N            Mes (1-12) para restringir a extracao
  --apenas-extracao  So extrai (salva raw); nao carrega no banco
  --apenas-carga     Pula a extracao; carrega o raw ja existente em data/raw/
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import setup_logging

log = setup_logging()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Pipeline isolado das despesas CEAP (extracao + carga)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--ano",
        type=int,
        default=None,
        help="Ano fiscal das despesas (default: ultimos 6 meses da API)",
    )
    parser.add_argument(
        "--mes",
        type=int,
        default=None,
        help="Mes (1-12) para restringir a extracao",
    )
    parser.add_argument(
        "--apenas-extracao",
        action="store_true",
        help="So extrai (salva raw em data/raw/); nao carrega no banco",
    )
    parser.add_argument(
        "--apenas-carga",
        action="store_true",
        help="Pula a extracao; carrega o raw ja existente",
    )
    args = parser.parse_args()

    if args.apenas_extracao and args.apenas_carga:
        log.error("--apenas-extracao e --apenas-carga sao mutuamente exclusivos.")
        return 2

    # -------------------------------------------------------------------------
    # ETAPA 1: Extracao das despesas CEAP (lento: ~1 chamada por deputado)
    # Salva em data/raw/deputados_despesas/<timestamp>_<deputado_id>.json
    # -------------------------------------------------------------------------
    if not args.apenas_carga:
        from src.extract.camara_api import CamaraAPIClient, fetch_all_deputados_despesas
        client = CamaraAPIClient()
        log.info("[Despesas 1/2] Extraindo CEAP | ano=%s mes=%s ...", args.ano, args.mes)
        saved = fetch_all_deputados_despesas(client, ano=args.ano, mes=args.mes)
        log.info("[Despesas 1/2] Extracao concluida: %d arquivos", len(saved))

    if args.apenas_extracao:
        log.info("Despesas: extracao concluida (--apenas-extracao). Carga pulada.")
        return 0

    # -------------------------------------------------------------------------
    # ETAPA 2: Transform + Carga em fato_despesas (idempotente, em lotes)
    # -------------------------------------------------------------------------
    from src.load.upsert import get_engine, upsert_despesas
    from src.transform.despesas import transform_despesas

    log.info("[Despesas 2/2] Transform + upsert em fato_despesas ...")
    engine = get_engine()
    n = upsert_despesas(transform_despesas(), engine)
    log.info("[Despesas 2/2] Carga concluida: %d registros em fato_despesas", n)

    log.info("Pipeline de despesas concluido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
