"""
Etapa 5 do pipeline (roadmap pos V1) -- Bridge de VOTOS nominais.

O QUE FAZ:
  Para cada votacao ainda sem votos carregados:
    1. resolve o vinculo votacao -> proposicao (via /votacoes/{id}, best-effort);
    2. busca os votos individuais em /votacoes/{id}/votos;
    3. popula fato_votacao_votos e atualiza fato_votacoes
       (proposicao_id, votos_carregados, qtd_votos).

  Destrava as analises de voto por partido / deputado / tema no dashboard.

NOTA: votacoes simbolicas costumam retornar lista de votos vazia -- isso e
normal (a Camara so registra voto nominal em votacoes nominais e abertas).

PRE-REQUISITOS:
  - sql/migration_autoria_votos.sql ja aplicado no banco
  - votacoes ja carregadas (scripts/2_run_pipeline.py)

Uso:
  python scripts/5_run_votes_bridge.py --limit 100
  python scripts/5_run_votes_bridge.py --only-missing
  python scripts/5_run_votes_bridge.py --votacao-id 2265603-49

Flags:
  --limit N        Maximo de votacoes a processar (default: 100)
  --only-missing   Processa apenas votacoes sem votos carregados
  --votacao-id ID  Processa uma unica votacao (id alfanumerico, ex: 2265603-49)
  --delay S        Pausa entre chamadas HTTP em segundos (default: 0.2)
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
        description="Bridge de votos nominais (votacao<->proposicao + voto por deputado)",
    )
    parser.add_argument("--limit", type=int, default=100,
                        help="Maximo de votacoes a processar (default: 100)")
    parser.add_argument("--only-missing", action="store_true",
                        help="Processa apenas votacoes sem votos carregados")
    parser.add_argument("--votacao-id", type=str, default=None,
                        help="Processa uma unica votacao (id alfanumerico, ex: 2265603-49)")
    parser.add_argument("--delay", type=float, default=0.2,
                        help="Pausa entre chamadas HTTP em segundos (default: 0.2)")
    args = parser.parse_args()

    from src.bridge.votos import run_votes_bridge

    contagem = run_votes_bridge(
        limit=args.limit,
        only_missing=args.only_missing,
        votacao_id=args.votacao_id,
        delay_seconds=args.delay,
    )
    log.info("Bridge de votos finalizado: %s", contagem)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
