"""
Cliente HTTP para a API de Dados Abertos da Camara dos Deputados.

Principios de design (ver docs/AGENT_INGESTOR.md):
  1. SEMPRE persistir o payload bruto antes de qualquer transformacao.
  2. Paginacao automatica via campo `links.rel='next'` (padrao HATEOAS).
  3. Retry exponencial em erros transitorios (5xx, 429, timeout, ConnectionError).
  4. Falha de um item NAO derruba o lote: erros sao logados e seguimos.
  5. Conhecer e DOCUMENTAR os defaults de cada endpoint -- eles podem trair.

Documentacao da API:
  Swagger:  https://dadosabertos.camara.leg.br/swagger/api.html
  Base URL: https://dadosabertos.camara.leg.br/api/v2
  Default page size: 15 itens  |  Max: 100 itens  |  Metodos: GET, HEAD
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import requests
from requests import Response
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.config import (
    CAMARA_API_BASE_URL,
    CAMARA_API_PAGE_SIZE,
    CAMARA_API_TIMEOUT_SECONDS,
    CAMARA_API_USER_AGENT,
    DATA_RAW_DIR,
)

log = logging.getLogger("bussola.extract")

# Excecoes consideradas TRANSITORIAS (retry vale a pena).
# 4xx (exceto 429) NAO entram aqui -- sao erros do nosso lado, nao adianta repetir.
_RETRYABLE_EXCEPTIONS = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ChunkedEncodingError,
)

# Tokens conhecidos como "nome de entidade" nos paths. Usado para distinguir
# nome-de-recurso de identificadores. Ex.: em "/votacoes/2024-1234-99/orientacoes",
# "votacoes" e "orientacoes" sao entidades; "2024-1234-99" e id.
_KNOWN_ENTITY_TOKENS: set[str] = {
    "deputados", "partidos", "proposicoes", "votacoes",
    "despesas", "orientacoes", "votos",
    "profissoes", "ocupacoes", "autores", "tramitacoes", "membros",
    "blocos", "eventos", "frentes", "legislaturas", "orgaos",
    "referencias", "discursos", "pauta",
}


class TransientHTTPError(Exception):
    """Erro 5xx ou 429 -- vale tentar de novo."""


class PermanentHTTPError(Exception):
    """Erro 4xx (exceto 429) -- nao adianta tentar de novo, e problema do request."""


# =============================================================================
# Helpers
# =============================================================================
def _find_next_link(links: list[dict[str, str]]) -> str | None:
    """Devolve o href do rel='next' nos links HATEOAS, ou None."""
    for link in links:
        if link.get("rel") == "next":
            return link.get("href")
    return None


def _path_to_entity_and_id(path: str) -> tuple[str, str | None]:
    """
    Converte um path em (nome_de_diretorio, identificador_para_filename).

    Exemplos:
        /deputados                          -> ('deputados',             None)
        /deputados/123                      -> ('deputados',             '123')
        /deputados/123/despesas             -> ('deputados_despesas',    '123')
        /votacoes/2024-1234-99              -> ('votacoes',              '2024-1234-99')
        /votacoes/2024-1234-99/votos        -> ('votacoes_votos',        '2024-1234-99')
        /votacoes/2024-1234-99/orientacoes  -> ('votacoes_orientacoes',  '2024-1234-99')
    """
    parts = [p for p in path.strip("/").split("/") if p]
    entity_parts: list[str] = []
    ident: str | None = None
    for p in parts:
        if p.lower() in _KNOWN_ENTITY_TOKENS:
            entity_parts.append(p.lower())
        else:
            # Tudo que nao e palavra de entidade conhecida vira identifier.
            ident = p
    entity = "_".join(entity_parts) if entity_parts else "unknown"
    return entity, ident


# =============================================================================
# Cliente HTTP base
# =============================================================================
@dataclass
class CamaraAPIClient:
    """
    Cliente fino sobre `requests` com retry, paginacao e persistencia de raw.

    Uso tipico:
        client = CamaraAPIClient()
        for page in client.paginate("/deputados", {"siglaUf": "SP"}):
            print(len(page["dados"]))
    """

    base_url: str = CAMARA_API_BASE_URL
    timeout: int = CAMARA_API_TIMEOUT_SECONDS
    page_size: int = CAMARA_API_PAGE_SIZE
    user_agent: str = CAMARA_API_USER_AGENT
    session: requests.Session = field(default_factory=requests.Session)

    def __post_init__(self) -> None:
        self.session.headers.update(
            {
                "User-Agent": self.user_agent,
                "Accept": "application/json",
            }
        )
        log.debug(
            "CamaraAPIClient inicializado: base_url=%s page_size=%s timeout=%ss",
            self.base_url,
            self.page_size,
            self.timeout,
        )

    # -------------------------------------------------------------------------
    # Camada baixa: GET com retry
    # -------------------------------------------------------------------------
    @retry(
        retry=retry_if_exception_type(_RETRYABLE_EXCEPTIONS + (TransientHTTPError,)),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        before_sleep=before_sleep_log(log, logging.WARNING),
        reraise=True,
    )
    def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """GET unico, com retry exponencial. Aceita URL absoluta OU path relativo."""
        if not url.startswith("http"):
            url = f"{self.base_url}{url}"

        log.debug("GET %s params=%s", url, params)
        response: Response = self.session.get(url, params=params, timeout=self.timeout)

        # Classifica o erro: transitorio (retry) ou permanente (aborta)
        if response.status_code >= 500 or response.status_code == 429:
            raise TransientHTTPError(
                f"HTTP {response.status_code} em {response.url}: {response.text[:200]}"
            )
        if response.status_code >= 400:
            raise PermanentHTTPError(
                f"HTTP {response.status_code} em {response.url}: {response.text[:200]}"
            )

        return response.json()

    # -------------------------------------------------------------------------
    # Camada media: paginacao automatica
    # -------------------------------------------------------------------------
    def paginate(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_pages: int | None = None,
    ) -> Iterator[dict[str, Any]]:
        """
        Itera sobre todas as paginas de um endpoint paginado.

        A API expoe links HATEOAS no campo `links`, com rel='next' indicando a
        proxima pagina. Quando nao ha mais `next`, paramos.

        Yields:
            dict com a pagina completa (chaves: 'dados', 'links').
        """
        params = {**(params or {}), "itens": self.page_size, "pagina": 1}
        next_url: str | None = None
        page_num = 0

        while True:
            page_num += 1
            if max_pages and page_num > max_pages:
                log.info("max_pages=%s atingido em %s", max_pages, path)
                break

            payload = self._get(next_url or path, params if next_url is None else None)
            n_items = len(payload.get("dados", []))
            log.info("[%s] pagina %d -> %d itens", path, page_num, n_items)
            yield payload

            # Procura o link "next" -- se nao existe, acabou
            next_url = _find_next_link(payload.get("links", []))
            if not next_url:
                log.info("[%s] paginacao concluida em %d pagina(s)", path, page_num)
                break

    # -------------------------------------------------------------------------
    # Camada alta: coleta + persistencia em JSON bruto
    # -------------------------------------------------------------------------
    def fetch_all(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_pages: int | None = None,
    ) -> list[dict[str, Any]]:
        """Coleta TODOS os itens de um endpoint paginado, concatenando as paginas."""
        all_items: list[dict[str, Any]] = []
        for page in self.paginate(path, params, max_pages):
            all_items.extend(page.get("dados", []))
        return all_items

    def save_raw(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_pages: int | None = None,
        out_dir: Path | None = None,
    ) -> Path:
        """
        Coleta tudo de um endpoint paginado e salva como JSON unico em
        data/raw/<entidade>/<timestamp>[_<id>].json.

        Para endpoints que retornam um unico recurso (sem paginacao), use `save_one`.
        """
        items = self.fetch_all(path, params, max_pages)
        entity, ident = _path_to_entity_and_id(path)
        out_dir = out_dir or (DATA_RAW_DIR / entity)
        out_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        suffix = f"_{ident}" if ident else ""
        out_path = out_dir / f"{ts}{suffix}.json"

        envelope = {
            "_meta": {
                "endpoint": path,
                "params": params or {},
                "fetched_at": ts,
                "count": len(items),
                "source": self.base_url,
            },
            "dados": items,
        }
        out_path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Salvo: %s (%d registros)", out_path, len(items))
        return out_path

    def save_one(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        out_dir: Path | None = None,
    ) -> Path:
        """
        Para endpoints que retornam um unico recurso (nao paginado).

        Exemplos: /deputados/{id}, /proposicoes/{id}, /votacoes/{id}.

        O envelope da API nesses casos tem chave `dados` com um unico objeto
        (nao uma lista). Preservamos exatamente como veio.
        """
        payload = self._get(path, params)
        entity, ident = _path_to_entity_and_id(path)
        out_dir = out_dir or (DATA_RAW_DIR / entity)
        out_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        suffix = f"_{ident}" if ident else ""
        out_path = out_dir / f"{ts}{suffix}.json"

        envelope = {
            "_meta": {
                "endpoint": path,
                "params": params or {},
                "fetched_at": ts,
                "source": self.base_url,
            },
            "dados": payload.get("dados", payload),
        }
        out_path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Salvo: %s", out_path)
        return out_path


# =============================================================================
# Atalhos convenientes -- Listagens (endpoints PAGINADOS)
# =============================================================================
def fetch_deputados(
    client: CamaraAPIClient | None = None,
    *,
    sigla_uf: str | None = None,
    sigla_partido: str | None = None,
    id_legislatura: int | None = None,
    sigla_sexo: str | None = None,
    nome: str | None = None,
    ordem: str | None = None,
    ordenar_por: str | None = None,
    max_pages: int | None = None,
) -> Path:
    """
    Cadastro de deputados.

    AVISO: sem `id_legislatura` ou outro filtro de tempo, a API retorna
    apenas deputados em exercicio no momento da requisicao. Para historico,
    informe `id_legislatura`.

    Args:
        ordem:        'ASC' ou 'DESC'
        ordenar_por:  campo de ordenacao (ex.: 'nome', 'siglaUf', 'siglaPartido')

    Salva em: data/raw/deputados/<timestamp>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if sigla_uf:
        params["siglaUf"] = sigla_uf
    if sigla_partido:
        params["siglaPartido"] = sigla_partido
    if id_legislatura:
        params["idLegislatura"] = id_legislatura
    if sigla_sexo:
        params["siglaSexo"] = sigla_sexo
    if nome:
        params["nome"] = nome
    if ordem:
        params["ordem"] = ordem
    if ordenar_por:
        params["ordenarPor"] = ordenar_por
    return client.save_raw("/deputados", params, max_pages)


def fetch_partidos(
    client: CamaraAPIClient | None = None,
    *,
    sigla: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    id_legislatura: int | None = None,
    max_pages: int | None = None,
) -> Path:
    """
    Cadastro de partidos.

    AVISO: sem parametros, retorna apenas partidos com deputados em exercicio
    no momento da requisicao.

    ATENCAO: a mesma sigla pode ter sido usada por partidos DIFERENTES em
    legislaturas distintas. Para historico nao-ambiguo, use `id_legislatura`.

    Salva em: data/raw/partidos/<timestamp>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if sigla:
        params["sigla"] = sigla
    if data_inicio:
        params["dataInicio"] = data_inicio
    if data_fim:
        params["dataFim"] = data_fim
    if id_legislatura:
        params["idLegislatura"] = id_legislatura
    return client.save_raw("/partidos", params, max_pages)


def fetch_proposicoes(
    client: CamaraAPIClient | None = None,
    *,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    data_apresentacao_inicio: str | None = None,
    data_apresentacao_fim: str | None = None,
    sigla_tipo: str | None = None,
    ano: int | None = None,
    numero: int | None = None,
    id_autor: int | None = None,
    autor: str | None = None,
    id_proposicao: int | None = None,
    max_pages: int | None = None,
) -> Path:
    """
    Proposicoes em tramitacao.

    AVISO: sem `data_inicio`/`data_fim`, a API retorna apenas proposicoes
    apresentadas OU com mudanca de situacao nos ultimos 30 dias.

    ARMADILHA: se passar `id_proposicao`, `ano`, `data_apresentacao_*`,
    `id_autor` ou `autor` SEM `data_inicio`/`data_fim`, o filtro temporal
    de 30 dias e IGNORADO -- voce pode acabar buscando todo o historico.
    Sempre prefira incrementar com `data_inicio`.

    Args:
        data_inicio:               YYYY-MM-DD (janela de TRAMITACAO)
        data_fim:                  YYYY-MM-DD (janela de TRAMITACAO)
        data_apresentacao_inicio:  YYYY-MM-DD (data de PROTOCOLO)
        data_apresentacao_fim:     YYYY-MM-DD (data de PROTOCOLO)
        sigla_tipo:                'PL', 'PEC', 'MPV', 'REQ', etc.

    Salva em: data/raw/proposicoes/<timestamp>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if id_proposicao:
        params["id"] = id_proposicao
    if data_inicio:
        params["dataInicio"] = data_inicio
    if data_fim:
        params["dataFim"] = data_fim
    if data_apresentacao_inicio:
        params["dataApresentacaoInicio"] = data_apresentacao_inicio
    if data_apresentacao_fim:
        params["dataApresentacaoFim"] = data_apresentacao_fim
    if sigla_tipo:
        params["siglaTipo"] = sigla_tipo
    if ano:
        params["ano"] = ano
    if numero:
        params["numero"] = numero
    if id_autor:
        params["idAutor"] = id_autor
    if autor:
        params["autor"] = autor
    return client.save_raw("/proposicoes", params, max_pages)


def fetch_votacoes(
    client: CamaraAPIClient | None = None,
    *,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    id_orgao: int | None = None,
    id_proposicao: int | None = None,
    max_pages: int | None = None,
) -> Path:
    """
    Eventos de votacao na Camara.

    Args:
        data_inicio / data_fim: YYYY-MM-DD (janela recomendada)
        id_orgao:               filtra por orgao (Plenario, comissoes)
        id_proposicao:          filtra votacoes de uma proposicao especifica

    Salva em: data/raw/votacoes/<timestamp>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if data_inicio:
        params["dataInicio"] = data_inicio
    if data_fim:
        params["dataFim"] = data_fim
    if id_orgao:
        params["idOrgao"] = id_orgao
    if id_proposicao:
        params["idProposicao"] = id_proposicao
    return client.save_raw("/votacoes", params, max_pages)


def fetch_deputado_despesas(
    client: CamaraAPIClient | None = None,
    *,
    deputado_id: int,
    ano: int | None = None,
    mes: int | None = None,
    id_legislatura: int | None = None,
    cnpj_cpf_fornecedor: str | None = None,
    ordem: str | None = None,
    ordenar_por: str | None = None,
    max_pages: int | None = None,
) -> Path:
    """
    Despesas declaradas via Cota para Exercicio da Atividade Parlamentar (CEAP).

    AVISO: sem nenhum parametro de tempo (`ano`, `mes`, `id_legislatura`),
    a API retorna apenas os 6 meses anteriores a requisicao. Para historico
    longo, itere sobre `ano` ou use `id_legislatura`.

    Args:
        ordem:        'ASC' ou 'DESC'
        ordenar_por:  campo de ordenacao (ex.: 'ano', 'mes', 'valorDocumento')

    Campos relevantes da resposta:
        ano, mes, tipoDespesa, codDocumento (PK natural, TEXT),
        tipoDocumento, dataDocumento, valorDocumento, valorLiquido,
        valorGlosa, nomeFornecedor, cnpjCpfFornecedor, parcela.

    MODELAGEM: `codDocumento` sozinho NAO e unico quando ha parcelamento.
    A chave natural completa e (codDocumento, parcela).

    Salva em: data/raw/deputados_despesas/<timestamp>_<deputado_id>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if ano:
        params["ano"] = ano
    if mes:
        params["mes"] = mes
    if id_legislatura:
        params["idLegislatura"] = id_legislatura
    if cnpj_cpf_fornecedor:
        params["cnpjCpfFornecedor"] = cnpj_cpf_fornecedor
    if ordem:
        params["ordem"] = ordem
    if ordenar_por:
        params["ordenarPor"] = ordenar_por
    return client.save_raw(f"/deputados/{deputado_id}/despesas", params, max_pages)


def fetch_votacao_orientacoes(
    client: CamaraAPIClient | None = None,
    *,
    votacao_id: str,
) -> Path:
    """
    Orientacoes das liderancas (partidos, blocos, Governo, Maioria, Oposicao,
    Minoria) para uma votacao especifica.

    Nota: so ha dados para votacoes de Plenario.
    Algumas votacoes nao tem orientacoes -- retorna lista vazia.

    Salva em: data/raw/votacoes_orientacoes/<timestamp>_<votacao_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_raw(f"/votacoes/{votacao_id}/orientacoes")


def fetch_votacao_votos(
    client: CamaraAPIClient | None = None,
    *,
    votacao_id: str,
) -> Path:
    """
    Votos individuais dos deputados em uma votacao nominal e aberta.

    AVISO: retorna lista vazia em votacoes simbolicas (em que votos individuais
    nao sao contabilizados). Excecao: votacoes simbolicas em que parlamentares
    pediram registro expresso do posicionamento.

    Parlamentares ausentes NAO sao listados.

    Salva em: data/raw/votacoes_votos/<timestamp>_<votacao_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_raw(f"/votacoes/{votacao_id}/votos")


# =============================================================================
# Atalhos convenientes -- Sub-recursos (paginados)
# =============================================================================
def fetch_deputado_profissoes(
    client: CamaraAPIClient | None = None,
    *,
    deputado_id: int,
) -> Path:
    """
    Profissoes declaradas pelo deputado.

    Estrutura: cada item tem `dataHora`, `codTipoProfissao`, `titulo`.
    Pode vir com todos os campos nulos se o deputado nao declarou.

    Salva em: data/raw/deputados_profissoes/<timestamp>_<deputado_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_raw(f"/deputados/{deputado_id}/profissoes")


def fetch_deputado_ocupacoes(
    client: CamaraAPIClient | None = None,
    *,
    deputado_id: int,
) -> Path:
    """
    Historico ocupacional do deputado (cargos, empregos previos).

    Estrutura: cada item tem `titulo`, `entidade`, `entidadeUF`,
    `entidadePais`, `anoInicio`, `anoFim`. Pode vir tudo nulo.

    Salva em: data/raw/deputados_ocupacoes/<timestamp>_<deputado_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_raw(f"/deputados/{deputado_id}/ocupacoes")


def fetch_proposicao_autores(
    client: CamaraAPIClient | None = None,
    *,
    proposicao_id: int,
) -> Path:
    """
    Autores de uma proposicao.

    MODELAGEM: a relacao proposicao <-> autor e N:N. Uma proposicao pode ter
    multiplos autores (coautoria). Este endpoint revela a lista completa,
    diferente do `proposicao.idAutor` simplificado da listagem `/proposicoes`.
    No modelo dimensional, justifica tabela ponte `ponte_proposicao_autores`.

    Salva em: data/raw/proposicoes_autores/<timestamp>_<proposicao_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_raw(f"/proposicoes/{proposicao_id}/autores")


def fetch_proposicao_tramitacoes(
    client: CamaraAPIClient | None = None,
    *,
    proposicao_id: int,
    data_inicio: str | None = None,
    data_fim: str | None = None,
) -> Path:
    """
    Historico de tramitacao de uma proposicao (despachos, mudancas de situacao).

    Salva em: data/raw/proposicoes_tramitacoes/<timestamp>_<proposicao_id>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if data_inicio:
        params["dataInicio"] = data_inicio
    if data_fim:
        params["dataFim"] = data_fim
    return client.save_raw(f"/proposicoes/{proposicao_id}/tramitacoes", params)


def fetch_proposicao_votacoes(
    client: CamaraAPIClient | None = None,
    *,
    proposicao_id: int,
) -> Path:
    """
    Votacoes relacionadas a uma proposicao especifica.

    Equivalente a `fetch_votacoes(id_proposicao=...)` mas com endpoint dedicado
    -- pode retornar mais detalhes contextualizados.

    Salva em: data/raw/proposicoes_votacoes/<timestamp>_<proposicao_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_raw(f"/proposicoes/{proposicao_id}/votacoes")


def fetch_partido_membros(
    client: CamaraAPIClient | None = None,
    *,
    partido_id: int,
    id_legislatura: int | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    max_pages: int | None = None,
) -> Path:
    """
    Deputados filiados a um partido especifico.

    AVISO: sem filtro de tempo, retorna apenas membros em exercicio no momento
    da requisicao. Para historico, passar `id_legislatura`.

    Salva em: data/raw/partidos_membros/<timestamp>_<partido_id>.json
    """
    client = client or CamaraAPIClient()
    params: dict[str, Any] = {}
    if id_legislatura:
        params["idLegislatura"] = id_legislatura
    if data_inicio:
        params["dataInicio"] = data_inicio
    if data_fim:
        params["dataFim"] = data_fim
    return client.save_raw(f"/partidos/{partido_id}/membros", params, max_pages)


# =============================================================================
# Atalhos convenientes -- Recursos unicos (endpoints SEM paginacao)
# =============================================================================
def fetch_deputado_detalhe(
    client: CamaraAPIClient | None = None,
    *,
    deputado_id: int,
) -> Path:
    """
    Dados cadastrais completos de um deputado especifico.

    Estrutura aninhada:
        dados.id, dados.uri
        dados.nomeCivil           -> nome de batismo
        dados.ultimoStatus.nome   -> nome parlamentar
        dados.ultimoStatus.nomeEleitoral
        dados.ultimoStatus.siglaPartido, .siglaUf, .idLegislatura
        dados.ultimoStatus.urlFoto, .email
        dados.ultimoStatus.gabinete.{nome, predio, sala, andar, telefone}

    MODELAGEM: a listagem `/deputados` traz `nome` (parlamentar). Este detalhe
    traz `nomeCivil` adicional. No schema dimensional, mapear ambos:
    `nome_parlamentar` e `nome_civil`.

    Salva em: data/raw/deputados/<timestamp>_<deputado_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_one(f"/deputados/{deputado_id}")


def fetch_partido_detalhe(
    client: CamaraAPIClient | None = None,
    *,
    partido_id: int,
) -> Path:
    """
    Dados completos de um partido especifico (lider atual, numero de membros,
    data de fundacao, programa, etc.).

    Salva em: data/raw/partidos/<timestamp>_<partido_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_one(f"/partidos/{partido_id}")


def fetch_proposicao_detalhe(
    client: CamaraAPIClient | None = None,
    *,
    proposicao_id: int,
) -> Path:
    """
    Dados completos de uma proposicao especifica (incluindo ultima situacao,
    despacho, links de tramitacao).

    Salva em: data/raw/proposicoes/<timestamp>_<proposicao_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_one(f"/proposicoes/{proposicao_id}")


def fetch_votacao_detalhe(
    client: CamaraAPIClient | None = None,
    *,
    votacao_id: str,
) -> Path:
    """
    Detalhe completo de uma votacao: proposicoes objeto, efeitos de tramitacao
    cadastrados em consequencia, resultado, descricao, data, orgao.

    Salva em: data/raw/votacoes/<timestamp>_<votacao_id>.json
    """
    client = client or CamaraAPIClient()
    return client.save_one(f"/votacoes/{votacao_id}")


# =============================================================================
# Extracao em lote
# =============================================================================
def fetch_all_deputados_despesas(
    client: CamaraAPIClient | None = None,
    *,
    ano: int | None = None,
    mes: int | None = None,
    id_legislatura: int | None = None,
    max_pages: int | None = None,
    delay_seconds: float = 0.5,
) -> list[Path]:
    """
    Busca despesas CEAP de TODOS os deputados em exercicio.

    Fluxo:
      1. Carrega a listagem de deputados do raw mais recente (ou busca na API).
      2. Itera sobre cada deputado_id chamando fetch_deputado_despesas.
      3. Salva um JSON por deputado em data/raw/deputados_despesas/.

    VOLUME: ~500 deputados. Pode demorar varios minutos dependendo dos filtros.
    RATE LIMIT: delay_seconds de pausa entre chamadas (default 0.5s).

    Args:
        ano:            Ano fiscal -- None retorna ultimos 6 meses (default da API).
        mes:            Mes (1-12) -- None retorna todos os meses do ano.
        id_legislatura: Filtra por legislatura especifica.
        max_pages:      Limite de paginas por deputado (None = todas).
        delay_seconds:  Pausa entre chamadas consecutivas.

    Returns:
        Lista de Paths dos JSONs salvos (um por deputado com registros).

    Salva em: data/raw/deputados_despesas/<timestamp>_<deputado_id>.json
    """
    import time as _time

    client = client or CamaraAPIClient()

    raw_deputados_dir = DATA_RAW_DIR / "deputados"
    list_files = sorted(
        f for f in raw_deputados_dir.glob("*.json")
        if "_" not in f.stem
    ) if raw_deputados_dir.exists() else []

    if list_files:
        log.info("Carregando deputados de %s", list_files[-1])
        envelope = json.loads(list_files[-1].read_text(encoding="utf-8"))
    else:
        log.info("Raw de deputados nao encontrado -- buscando na API...")
        fetch_deputados(client)
        list_files = sorted(
            f for f in raw_deputados_dir.glob("*.json")
            if "_" not in f.stem
        )
        envelope = json.loads(list_files[-1].read_text(encoding="utf-8"))

    ids: list[int] = [
        int(d["id"]) for d in envelope.get("dados", []) if d.get("id")
    ]
    log.info(
        "Iniciando extracao de despesas: %d deputados | ano=%s mes=%s",
        len(ids), ano, mes,
    )

    saved: list[Path] = []
    for i, dep_id in enumerate(ids, 1):
        log.info("[%d/%d] Deputado %s", i, len(ids), dep_id)
        try:
            path = fetch_deputado_despesas(
                client,
                deputado_id=dep_id,
                ano=ano,
                mes=mes,
                id_legislatura=id_legislatura,
                max_pages=max_pages,
            )
            saved.append(path)
        except PermanentHTTPError as exc:
            log.warning("Deputado %s ignorado: %s", dep_id, exc)
        if delay_seconds > 0 and i < len(ids):
            _time.sleep(delay_seconds)

    log.info("Extracao de despesas concluida: %d arquivos gerados", len(saved))
    return saved
