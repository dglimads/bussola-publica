"""
Ferramenta de exploracao da API da Camara -- Sprint 1.

QUANDO RODAR:
  Use este script para inspecionar a estrutura dos dados ANTES de implementar
  o pipeline. Ele faz chamadas pequenas (1-2 paginas) e salva os JSONs em
  data/raw/ para voce abrir no VS Code ou no notebook.

O QUE FAZ:
  Executa coletas limitadas de cada endpoint para validar que o cliente HTTP
  funciona e que os campos retornados correspondem ao schema planejado.

MODOS DISPONIVEIS (--apenas):
  listagens     4 listagens paginadas (deputados, partidos, proposicoes, votacoes) [DEFAULT]
  detalhe       detalhe de um deputado + uma votacao (precisa --id-deputado e --id-votacao)
  despesas      CEAP de um deputado (precisa --id-deputado)
  profissoes    profissoes declaradas de um deputado (precisa --id-deputado)
  ocupacoes     historico ocupacional de um deputado (precisa --id-deputado)
  autores       autores de uma proposicao -- revela relacao N:N (precisa --id-proposicao)
  tramitacoes   historico de tramitacao de uma proposicao (precisa --id-proposicao)
  orientacoes   orientacoes de bancada de uma votacao (precisa --id-votacao)
  votos         votos individuais de uma votacao (precisa --id-votacao)
  partido       detalhe + membros de um partido (precisa --id-partido)
  tudo          todos os modos acima (precisa os 4 --id-*)

EXEMPLOS:
  python scripts/explore_api.py
  python scripts/explore_api.py --apenas listagens --paginas 2 --dias 14
  python scripts/explore_api.py --apenas detalhe --id-deputado 220714 --id-votacao 2272615-43
  python scripts/explore_api.py --apenas despesas --id-deputado 220714 --ano 2026
  python scripts/explore_api.py --apenas autores --id-proposicao 2255685
  python scripts/explore_api.py --apenas partido --id-partido 36844

Os JSONs ficam em data/raw/<entidade>/<timestamp>.json e NAO vao pro Git.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

# Garante que `src` e importavel quando rodando direto
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import setup_logging  # noqa: E402
from src.extract.camara_api import (  # noqa: E402
    CamaraAPIClient,
    fetch_deputado_despesas,
    fetch_deputado_detalhe,
    fetch_deputado_ocupacoes,
    fetch_deputado_profissoes,
    fetch_deputados,
    fetch_partido_detalhe,
    fetch_partido_membros,
    fetch_partidos,
    fetch_proposicao_autores,
    fetch_proposicao_detalhe,
    fetch_proposicao_tramitacoes,
    fetch_proposicoes,
    fetch_votacao_detalhe,
    fetch_votacao_orientacoes,
    fetch_votacao_votos,
    fetch_votacoes,
)

log = setup_logging()


def _explorar_listagens(client: CamaraAPIClient, dias: int, paginas: int) -> list[Path]:
    """As 4 listagens paginadas principais."""
    data_fim = date.today().isoformat()
    data_inicio = (date.today() - timedelta(days=dias)).isoformat()

    log.info("Janela de datas: %s -> %s", data_inicio, data_fim)
    saved: list[Path] = []

    log.info("-- Deputados (todos em exercicio) --")
    saved.append(fetch_deputados(client, max_pages=paginas))

    log.info("-- Partidos (com deputados em exercicio) --")
    saved.append(fetch_partidos(client, max_pages=paginas))

    log.info("-- Proposicoes (tramitacao recente) --")
    saved.append(
        fetch_proposicoes(
            client,
            data_inicio=data_inicio,
            data_fim=data_fim,
            max_pages=paginas,
        )
    )

    log.info("-- Votacoes --")
    saved.append(
        fetch_votacoes(
            client,
            data_inicio=data_inicio,
            data_fim=data_fim,
            max_pages=paginas,
        )
    )
    return saved


def _explorar_detalhe(
    client: CamaraAPIClient,
    id_deputado: int | None,
    id_votacao: str | None,
) -> list[Path]:
    """Detalhe completo de um deputado e de uma votacao especificos."""
    saved: list[Path] = []

    if id_deputado:
        log.info("-- Detalhe do Deputado %s --", id_deputado)
        saved.append(fetch_deputado_detalhe(client, deputado_id=id_deputado))
    else:
        log.warning("Sem --id-deputado, pulando detalhe de deputado.")

    if id_votacao:
        log.info("-- Detalhe da Votacao %s --", id_votacao)
        saved.append(fetch_votacao_detalhe(client, votacao_id=id_votacao))
    else:
        log.warning("Sem --id-votacao, pulando detalhe de votacao.")

    return saved


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Exploracao inicial da API da Camara dos Deputados",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apenas",
        choices=[
            "listagens", "detalhe", "despesas",
            "orientacoes", "votos",
            "profissoes", "ocupacoes",
            "autores", "tramitacoes",
            "partido", "tudo",
        ],
        default="listagens",
        help="O que extrair (default: listagens)",
    )
    parser.add_argument(
        "--paginas",
        type=int,
        default=1,
        help="Maximo de paginas em listagens (default: 1, cada uma com ate 100 itens)",
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=7,
        help="Janela de dias para /proposicoes e /votacoes (default: 7)",
    )
    parser.add_argument(
        "--id-deputado",
        type=int,
        default=None,
        help="ID de um deputado (para --apenas detalhe/despesas)",
    )
    parser.add_argument(
        "--id-votacao",
        type=str,
        default=None,
        help="ID de uma votacao, ex.: 2272615-43 (para --apenas detalhe/orientacoes/votos)",
    )
    parser.add_argument(
        "--id-proposicao",
        type=int,
        default=None,
        help="ID de uma proposicao (para --apenas autores/tramitacoes)",
    )
    parser.add_argument(
        "--id-partido",
        type=int,
        default=None,
        help="ID de um partido (para --apenas partido)",
    )
    parser.add_argument(
        "--ano",
        type=int,
        default=None,
        help="Ano para filtro de despesas (default: 6 meses anteriores se omitido)",
    )
    parser.add_argument(
        "--mes",
        type=int,
        default=None,
        help="Mes (1-12) para filtro de despesas",
    )
    args = parser.parse_args()

    client = CamaraAPIClient()
    saved: list[Path] = []

    log.info("Bussola Publica -- Exploracao da API")
    log.info("Modo: %s  |  paginas max: %d", args.apenas, args.paginas)

    if args.apenas in ("listagens", "tudo"):
        saved += _explorar_listagens(client, args.dias, args.paginas)

    if args.apenas in ("detalhe", "tudo"):
        saved += _explorar_detalhe(client, args.id_deputado, args.id_votacao)

    if args.apenas in ("despesas", "tudo"):
        if not args.id_deputado:
            log.error("--id-deputado e obrigatorio para extrair despesas")
            return 2
        log.info("-- Despesas do Deputado %s --", args.id_deputado)
        saved.append(
            fetch_deputado_despesas(
                client,
                deputado_id=args.id_deputado,
                ano=args.ano,
                mes=args.mes,
                max_pages=args.paginas,
            )
        )

    if args.apenas in ("orientacoes", "tudo"):
        if not args.id_votacao:
            log.error("--id-votacao e obrigatorio para extrair orientacoes")
            return 2
        log.info("-- Orientacoes da Votacao %s --", args.id_votacao)
        saved.append(fetch_votacao_orientacoes(client, votacao_id=args.id_votacao))

    if args.apenas in ("votos", "tudo"):
        if not args.id_votacao:
            log.error("--id-votacao e obrigatorio para extrair votos")
            return 2
        log.info("-- Votos da Votacao %s --", args.id_votacao)
        saved.append(fetch_votacao_votos(client, votacao_id=args.id_votacao))

    if args.apenas in ("profissoes", "tudo"):
        if not args.id_deputado:
            log.error("--id-deputado e obrigatorio para extrair profissoes")
            return 2
        log.info("-- Profissoes do Deputado %s --", args.id_deputado)
        saved.append(fetch_deputado_profissoes(client, deputado_id=args.id_deputado))

    if args.apenas in ("ocupacoes", "tudo"):
        if not args.id_deputado:
            log.error("--id-deputado e obrigatorio para extrair ocupacoes")
            return 2
        log.info("-- Ocupacoes do Deputado %s --", args.id_deputado)
        saved.append(fetch_deputado_ocupacoes(client, deputado_id=args.id_deputado))

    if args.apenas in ("autores", "tudo"):
        if not args.id_proposicao:
            log.error("--id-proposicao e obrigatorio para extrair autores")
            return 2
        log.info("-- Autores da Proposicao %s --", args.id_proposicao)
        saved.append(fetch_proposicao_autores(client, proposicao_id=args.id_proposicao))

    if args.apenas in ("tramitacoes", "tudo"):
        if not args.id_proposicao:
            log.error("--id-proposicao e obrigatorio para extrair tramitacoes")
            return 2
        log.info("-- Tramitacoes da Proposicao %s --", args.id_proposicao)
        saved.append(fetch_proposicao_tramitacoes(client, proposicao_id=args.id_proposicao))

    if args.apenas in ("partido", "tudo"):
        if not args.id_partido:
            log.error("--id-partido e obrigatorio para extrair detalhe/membros do partido")
            return 2
        log.info("-- Detalhe do Partido %s --", args.id_partido)
        saved.append(fetch_partido_detalhe(client, partido_id=args.id_partido))
        log.info("-- Membros do Partido %s --", args.id_partido)
        saved.append(
            fetch_partido_membros(
                client, partido_id=args.id_partido, max_pages=args.paginas
            )
        )

    log.info("Concluido. Arquivos gerados:")
    for p in saved:
        log.info("  %s", p)
    log.info(
        "Proximo passo: abrir um JSON no VS Code, conferir a estrutura, "
        "e seguir para notebooks/01_exploracao_api.ipynb"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
