"""
Transforma o payload de /proposicoes/{id}/autores em registros da ponte
ponte_proposicao_autores.

A relacao proposicao<->autor e N:N. Este modulo so faz mapeamento PURO
(sem I/O, sem banco) -- a orquestracao (fetch + upsert + flags) fica em
src/bridge/autores.py.

Campos do payload da API (dados[]):
    uri, nome, codTipo, tipo, ordemAssinatura, proponente

Regra do autor_id: extrair o numero final da uri
    https://.../deputados/204554 -> 204554
"""
from __future__ import annotations

import logging
from typing import Any

from src.utils.text import clean_text, safe_str

log = logging.getLogger("bussola.transform")


def extract_numeric_id_from_uri(uri: str | None) -> int | None:
    """
    Extrai o id numerico do final de uma uri da API.

    Exemplos:
        '.../deputados/204554'   -> 204554
        '.../partidos/36898/'    -> 36898
        '.../orgaos/Comissao'    -> None  (nao termina em numero)
        None                     -> None
    """
    if not uri:
        return None
    last = uri.rstrip("/").split("/")[-1]
    return int(last) if last.isdigit() else None


def normalize_bool(value: Any) -> bool:
    """
    Converte representacoes variadas de booleano da API para bool.

    A API costuma mandar proponente como 1/0 (int), mas pode vir bool ou string.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return int(value) == 1
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "s", "sim", "t")
    return False


def _entity_from_uri(uri: str | None) -> str | None:
    """
    Devolve o segmento de entidade de uma uri da API (o que vem antes do id).

    A API identifica o autor pelo caminho da uri, nao pelo campo `tipo` (que vem
    com variacoes como 'Deputado(a)', 'COMISSAO PERMANENTE', 'Orgao do Poder
    Executivo'). Por isso o vinculo deve sair da uri, nao da string `tipo`.

    Exemplos:
        '.../deputados/178871' -> 'deputados'
        '.../partidos/36898/'  -> 'partidos'
        '.../orgaos/253'       -> 'orgaos'
        None                   -> None
    """
    if not uri:
        return None
    partes = [p for p in uri.rstrip("/").split("/") if p]
    if len(partes) >= 2 and partes[-1].isdigit():
        return partes[-2].lower()
    return None


def map_author(proposicao_id: int, author: dict[str, Any]) -> dict[str, Any]:
    """
    Mapeia um item de autor da API para um registro da ponte.

    Quando o autor e Deputado, preenche deputado_id; quando e Partido, preenche
    partido_id. Para Comissao/Senado/Orgao/Executivo, ambos ficam None e o
    vinculo se da apenas por nome_autor/uri_autor.

    O TIPO e inferido pela URI (segmento /deputados/ ou /partidos/), nao pela
    string `tipo` da API -- esta vem com variacoes ('Deputado(a)', etc.) que
    quebram comparacao por igualdade.
    """
    uri = safe_str(author.get("uri"))
    tipo = safe_str(author.get("tipo"))
    autor_id = extract_numeric_id_from_uri(uri)
    entidade = _entity_from_uri(uri)

    deputado_id = autor_id if entidade == "deputados" else None
    partido_id = autor_id if entidade == "partidos" else None

    return {
        "proposicao_id": int(proposicao_id),
        "autor_id": autor_id,
        "autor_tipo": tipo or "Desconhecido",
        "deputado_id": deputado_id,
        "partido_id": partido_id,
        # nome_autor e NOT NULL na tabela -> garante fallback nao vazio
        "nome_autor": clean_text(safe_str(author.get("nome"))) or "(sem nome)",
        "cod_tipo_autor": author.get("codTipo"),
        "ordem_assinatura": author.get("ordemAssinatura"),
        "proponente": normalize_bool(author.get("proponente")),
        "uri_autor": uri,
        "raw_payload": author,
    }


def transform_autores(proposicao_id: int, dados: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Converte a lista crua de autores de uma proposicao em registros da ponte,
    deduplicando por (autor_tipo, nome_autor, uri_autor) -- a mesma chave de
    idempotencia usada no upsert.
    """
    registros: list[dict[str, Any]] = []
    vistos: set[tuple[str, str, str]] = set()
    for author in dados or []:
        reg = map_author(proposicao_id, author)
        chave = (reg["autor_tipo"], reg["nome_autor"], reg["uri_autor"] or "")
        if chave in vistos:
            continue
        vistos.add(chave)
        registros.append(reg)
    return registros


def choose_main_author(registros: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Elege o autor principal por ordem de prioridade:
      1. proponente = true (menor ordem_assinatura entre eles)
      2. menor ordem_assinatura
      3. primeiro item retornado pela API

    Devolve None se a lista estiver vazia.
    """
    if not registros:
        return None

    def _ordem(reg: dict[str, Any]) -> int:
        valor = reg.get("ordem_assinatura")
        return valor if isinstance(valor, int) else 999_999

    proponentes = [r for r in registros if r.get("proponente")]
    if proponentes:
        return sorted(proponentes, key=_ordem)[0]

    com_ordem = [r for r in registros if isinstance(r.get("ordem_assinatura"), int)]
    if com_ordem:
        return sorted(com_ordem, key=_ordem)[0]

    return registros[0]
