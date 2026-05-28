# API da Camara dos Deputados — Referencia Rapida

**Base URL:** `https://dadosabertos.camara.leg.br/api/v2`
**Swagger:** `https://dadosabertos.camara.leg.br/swagger/api.html`
**Autenticacao:** Nenhuma (API publica)

---

## Endpoints Implementados

### Paginados (usar `save_raw`)

| Endpoint | Filtros criticos | Armadilha |
|----------|-----------------|-----------|
| `GET /deputados` | `idLegislatura`, `itens=100` | Sem filtro → so correntes |
| `GET /partidos` | `idLegislatura`, `itens=100` | Sem filtro → so com deputados correntes |
| `GET /proposicoes` | `dataInicio`, `dataFim`, `itens=100` | Sem janela → so 30 dias |
| `GET /votacoes` | `dataInicio`, `dataFim`, `itens=100` | — |
| `GET /deputados/{id}/despesas` | `ano`, `itens=100` | Sem ano → so 6 meses |

### Unicos (usar `save_one`)

| Endpoint | Campos extras disponiveis |
|----------|--------------------------|
| `GET /deputados/{id}` | `nomeCivil`, `ultimoStatus.foto`, `gabinete.*` |
| `GET /proposicoes/{id}` | `situacao`, `despacho` |
| `GET /votacoes/{id}` | `proposicaoObjeto` (texto livre, nao ID) |

---

## Schema de Resposta Paginada

```json
{
  "_meta": { ... },
  "dados": [...],
  "links": [
    { "rel": "self",  "href": "..." },
    { "rel": "first", "href": "..." },
    { "rel": "next",  "href": "..." },  // ausente na ultima pagina
    { "rel": "last",  "href": "..." }
  ]
}
```

Paginacao: seguir `links[rel=next]` ate ausente. Nunca confiar em contagem total.

---

## Defaults Silenciosos (SEMPRE passar parametros explicitos)

| Endpoint | Default sem parametro | Impacto |
|----------|----------------------|---------|
| `/proposicoes` | 30 dias de historico | Perde tudo antes de 30 dias |
| `/deputados/{id}/despesas` | 6 meses | Perde historico CEAP |
| `/deputados` | So exercicio atual | Perde ex-deputados |
| Qualquer listagem | 15 itens por pagina | 6x mais requests |

---

## Envelope Interno (formato gravado em `data/raw/`)

```json
{
  "_meta": {
    "endpoint": "/proposicoes",
    "params": {"itens": 100, "dataInicio": "2026-01-01"},
    "fetched_at": "2026-05-17T10:00:00Z",
    "count": 100,
    "source": "https://dadosabertos.camara.leg.br/api/v2"
  },
  "dados": [ /* itens brutos exatamente como vieram da API */ ]
}
```

---

## Comportamentos Especiais

- `votacoes/{id}/votos` vazio → votacao simbolica (nao ausencia de votacao)
- `votacoes/{id}/orientacoes` → so disponivel em votacoes do Plenario
- `proposicoes/{id}/autores` → relacao N:N (pode ter varios autores)
- `deputados` sem `idLegislatura` → so legislatura corrente (57a)

---

## Roadmap de Endpoints Nao Implementados

| Endpoint | Caso de uso |
|----------|------------|
| `GET /eventos` | Agenda da Camara |
| `GET /orgaos` | Analise por comissao |
| `GET /frentes`, `/blocos` | Articulacao parlamentar |
| `GET /referencias/*` | Tabelas de dominio (tipos de PL, situacoes) |
