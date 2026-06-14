"""
Etapa 4 do pipeline (roadmap pos V1) -- Bridge de AUTORIA.

O QUE FAZ:
  Para cada proposicao ainda sem autores carregados, chama
  /proposicoes/{id}/autores, popula a tabela ponte ponte_proposicao_autores
  (relacao N:N) e atualiza as flags de autoria em fato_proposicoes
  (autores_carregados, qtd_autores, autor_principal_*).

  E o que destrava o heatmap tema x partido e as metricas de proposicoes
  por deputado/partido no dashboard.

PRE-REQUISITOS:
  - sql/migration_autoria_votos.sql ja aplicado no banco
  - proposicoes ja carregadas (scripts/2_run_pipeline.py)

ORDEM RECOMENDADA:
  1. python scripts/1_run_extraction.py
  2. python scripts/2_run_pipeline.py --apenas-carga
  3. python scripts/3_run_ai_enrichment.py --limite 50
  4. python scripts/4_run_authors_bridge.py --only-missing   <- voce esta aqui
  5. python scripts/5_run_votes_bridge.py --only-missing

Uso:
  python scripts/4_run_authors_bridge.py --limit 500
  python scripts/4_run_authors_bridge.py --only-missing
  python scripts/4_run_authors_bridge.py --proposicao-id 2345678

Flags:
  --limit N         Maximo de proposicoes a processar (default: 500)
  --only-missing    Processa apenas proposicoes sem autores carregados
  --proposicao-id N Processa uma unica proposicao (reprocessa mesmo se ja carregada)
  --delay S         Pausa entre chamadas HTTP em segundos (default: 0.2)
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
        description="Bridge de autoria (ponte proposicao<->autor) -- roadmap pos V1",
    )
    parser.add_argument("--limit", type=int, default=500,
                        help="Maximo de proposicoes a processar (default: 500)")
    parser.add_argument("--only-missing", action="store_true",
                        help="Processa apenas proposicoes sem autores carregados")
    parser.add_argument("--proposicao-id", type=int, default=None,
                        help="Processa uma unica proposicao (reprocessa mesmo se ja carregada)")
    parser.add_argument("--delay", type=float, default=0.2,
                        help="Pausa entre chamadas HTTP em segundos (default: 0.2)")
    args = parser.parse_args()

    from src.bridge.autores import run_authors_bridge

    contagem = run_authors_bridge(
        limit=args.limit,
        only_missing=args.only_missing,
        proposicao_id=args.proposicao_id,
        delay_seconds=args.delay,
    )
    log.info("Bridge de autoria finalizado: %s", contagem)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
