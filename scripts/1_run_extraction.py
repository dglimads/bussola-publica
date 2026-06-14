"""
Etapa 1 do pipeline: extracao de dados da API da Camara.

QUANDO RODAR:
  Execute este script PRIMEIRO, antes de 2_run_pipeline.py ou qualquer carga.
  Ele salva os dados brutos em data/raw/ que os demais scripts precisam.

O QUE FAZ:
  - Extrai as 4 entidades principais: deputados, partidos, proposicoes, votacoes.

  As despesas CEAP (lentas, fora do escopo do Radar Legislativo) NAO sao extraidas
  aqui -- elas tem pipeline proprio: python scripts/6_run_despesas.py

PROXIMOS PASSOS:
  Apos rodar, execute: python scripts/2_run_pipeline.py --apenas-carga
  Ou o pipeline completo: python scripts/2_run_pipeline.py

ORDEM RECOMENDADA DE USO:
  1. python scripts/1_run_extraction.py              # extrai base (rapido, ~2min)
  2. python scripts/2_run_pipeline.py --apenas-carga  # carrega no banco
  3. python scripts/6_run_despesas.py                 # despesas, por ultimo (lento)

Flags:
  --dias N   Janela de dias para proposicoes e votacoes (default: 1 = ontem)
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

    log.info("Extracao concluida. Proximos passos:")
    log.info("  python scripts/2_run_pipeline.py --apenas-carga")
    log.info("  python scripts/6_run_despesas.py   (despesas CEAP, por ultimo)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
