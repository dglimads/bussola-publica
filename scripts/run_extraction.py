"""
Etapa 1 de 3 do pipeline: extracao de dados da API da Camara.

QUANDO RODAR:
  Execute este script PRIMEIRO, antes de run_pipeline.py ou qualquer carga.
  Ele salva os dados brutos em data/raw/ que os demais scripts precisam.

O QUE FAZ:
  - Extrai as 4 entidades principais: deputados, partidos, proposicoes, votacoes.
  - Opcionalmente extrai as despesas CEAP de todos os deputados (~500 chamadas HTTP).

PROXIMOS PASSOS:
  Apos rodar, execute: python scripts/run_pipeline.py --apenas-carga
  Ou o pipeline completo: python scripts/run_pipeline.py

ORDEM RECOMENDADA DE USO:
  1. python scripts/run_extraction.py            # extrai base (rapido, ~2min)
  2. python scripts/run_extraction.py --incluir-despesas  # adiciona CEAP (lento, ~10-20min)
  3. python scripts/run_pipeline.py --apenas-carga        # carrega tudo no banco

Flags:
  --dias N             Janela de dias para proposicoes e votacoes (default: 1 = ontem)
  --incluir-despesas   Extrai despesas CEAP de todos os deputados
  --ano-despesas N     Ano fiscal para despesas (default: ultimos 6 meses da API)
  --mes-despesas N     Mes (1-12) para despesas
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import setup_logging
from src.extract.camara_api import (
    CamaraAPIClient,
    fetch_deputados,
    fetch_partidos,
    fetch_proposicoes,
    fetch_votacoes,
)

log = setup_logging()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extracao completa da API da Camara",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=1,
        help="Janela de dias para proposicoes e votacoes (default: 1 = ontem)",
    )
    parser.add_argument(
        "--incluir-despesas",
        action="store_true",
        help="Extrai despesas CEAP de todos os deputados (~500 chamadas, pode demorar)",
    )
    parser.add_argument(
        "--ano-despesas",
        type=int,
        default=None,
        help="Ano fiscal para despesas (default: ultimos 6 meses)",
    )
    parser.add_argument(
        "--mes-despesas",
        type=int,
        default=None,
        help="Mes (1-12) para despesas",
    )
    args = parser.parse_args()

    data_fim = date.today().isoformat()
    data_inicio = (date.today() - timedelta(days=args.dias)).isoformat()

    log.info("Extracao iniciada | janela: %s -> %s", data_inicio, data_fim)

    # Cria cliente HTTP compartilhado (reusa conexao TCP, aplica retry)
    client = CamaraAPIClient()

    # -------------------------------------------------------------------------
    # Entidades base -- sempre extraidas
    # Salva em data/raw/{deputados,partidos,proposicoes,votacoes}/<timestamp>.json
    # -------------------------------------------------------------------------
    log.info("[1/4] Extraindo deputados...")
    fetch_deputados(client)

    log.info("[2/4] Extraindo partidos...")
    fetch_partidos(client)

    log.info("[3/4] Extraindo proposicoes (janela: %s a %s)...", data_inicio, data_fim)
    fetch_proposicoes(client, data_inicio=data_inicio, data_fim=data_fim)

    log.info("[4/4] Extraindo votacoes (janela: %s a %s)...", data_inicio, data_fim)
    fetch_votacoes(client, data_inicio=data_inicio, data_fim=data_fim)

    # -------------------------------------------------------------------------
    # Despesas CEAP -- opcional (lento: ~1 chamada por deputado, ~500 total)
    # Salva em data/raw/deputados_despesas/<timestamp>_<deputado_id>.json
    # -------------------------------------------------------------------------
    if args.incluir_despesas:
        from src.extract.camara_api import fetch_all_deputados_despesas
        log.info(
            "Extraindo despesas CEAP | ano=%s mes=%s",
            args.ano_despesas, args.mes_despesas,
        )
        fetch_all_deputados_despesas(
            client,
            ano=args.ano_despesas,
            mes=args.mes_despesas,
        )

    log.info("Extracao concluida. Proximos passos:")
    log.info("  python scripts/run_pipeline.py --apenas-carga")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
