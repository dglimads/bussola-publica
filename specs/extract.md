# Spec: Extracao — Bussola Publica

**Status:** active
**Versao:** 1.4
**Ultima atualizacao:** 2026-06-14
**Implementacao:** `src/extract/camara_api.py`, `scripts/1_run_extraction.py`, `src/bridge/`
**Agent detalhado:** `docs/AGENT_INGESTOR.md`

---

## Contexto

Camada responsavel por trazer dados da API publica da Camara dos Deputados
(`dadosabertos.camara.leg.br/api/v2`) para o disco local em formato JSON imutavel.
Nada e transformado, validado ou carregado nesta etapa.

**Mandato:** "Bruto, integro, rastreavel, idempotente."

---

## API da Camara — Referencia Rapida

| Aspecto | Valor |
|---------|-------|
| Base URL | `https://dadosabertos.camara.leg.br/api/v2` |
| Autenticacao | Nenhuma (API publica) |
| Max page size | 100 itens (usar sempre `itens=100`) |
| Paginacao | HATEOAS — seguir `links[].rel == "next"` |
| Rate limit | Nao documentado; max 4 workers paralelos |
| Timeout padrao | 30s (configuravel via `CAMARA_API_TIMEOUT_SECONDS`) |

---

## Endpoints Implementados

### Entidades principais (paginadas)

| Endpoint | Parametros obrigatorios | Parametros opcionais | Metodo |
|----------|------------------------|---------------------|--------|
| `GET /deputados` | `itens=100` | `idLegislatura`, `siglaUf`, `siglaPartido` | `fetch_deputados()` |
| `GET /partidos` | `itens=100` | `idLegislatura`, `dataInicio`, `dataFim` | `fetch_partidos()` |
| `GET /proposicoes` | `itens=100`, `dataInicio`, `dataFim` | `siglaTipo`, `ano` | `fetch_proposicoes()` |
| `GET /votacoes` | `itens=100`, `dataInicio`, `dataFim` | `idOrgao`, `idProposicao` | `fetch_votacoes()` |

### Sub-recursos por deputado (paginados por ID)

| Endpoint | Parametros obrigatorios | Metodo |
|----------|------------------------|--------|
| `GET /deputados/{id}/despesas` | `ano` (ou `idLegislatura`) | `fetch_despesas_deputado(id, ano)` |

### Recursos unicos (sem paginacao)

| Endpoint | Quando usar | Metodo |
|----------|-------------|--------|
| `GET /deputados/{id}` | Campos detalhados (nomeCivil, gabinete, foto) | `save_one()` |
| `GET /proposicoes/{id}` | Situacao atual, despacho | `save_one()` |

### Autoria e votos (bridges pos-V1)

| Endpoint | Quando usar | Metodo |
|----------|-------------|--------|
| `GET /proposicoes/{id}/autores` | Popular a ponte N:N de autoria | `fetch_proposicao_autores(id)` |
| `GET /votacoes/{id}` | Resolver vinculo votacao->proposicao | `fetch_votacao_detalhe(id)` |
| `GET /votacoes/{id}/votos` | Votos nominais por deputado | `fetch_votacao_votos(id)` |

Consumidos por `scripts/4_run_authors_bridge.py` e `scripts/5_run_votes_bridge.py`
(orquestracao em `src/bridge/autores.py` e `src/bridge/votos.py`). Persistem raw em
`proposicoes_autores/` e `votacoes_votos/` antes de transformar.

---

## Armadilhas dos Defaults da API (MEMORIZAR)

| Endpoint | Default silencioso | Consequencia | Solucao |
|----------|-------------------|--------------|---------|
| `/proposicoes` sem `dataInicio` | Apenas ultimos 30 dias | Perde historico | Sempre passar janela |
| `/deputados/{id}/despesas` sem `ano` | Apenas 6 meses anteriores | Perde historico CEAP | Iterar por `ano` |
| `/deputados` sem `idLegislatura` | Apenas deputados em exercicio agora | Nao captura historico | Passar `idLegislatura` |
| `/partidos` sem filtro | Apenas partidos ativos agora | Nao captura extintos | Passar `idLegislatura` |
| Qualquer listagem sem `itens` | 15 itens por pagina | 6x mais requests | Sempre `itens=100` |

---

## Formato de Output

### Listagem paginada (`save_raw`)

```
data/raw/<entidade>/<YYYY-MM-DDTHH-MM-SSZ>.json
```

```json
{
  "_meta": {
    "endpoint": "/deputados",
    "params": {"itens": 100, "siglaUf": "SP"},
    "fetched_at": "2026-05-17T10:30:00Z",
    "count": 70,
    "source": "https://dadosabertos.camara.leg.br/api/v2"
  },
  "dados": [ /* array de itens brutos da API, sem normalizacao */ ]
}
```

### Recurso unico (`save_one`)

```
data/raw/<entidade>/<YYYY-MM-DDTHH-MM-SSZ>_<id>.json
```

```json
{
  "_meta": {
    "endpoint": "/deputados/220714",
    "params": {},
    "fetched_at": "2026-05-17T10:30:15Z",
    "source": "https://dadosabertos.camara.leg.br/api/v2"
  },
  "dados": { /* objeto unico — nao e lista */ }
}
```

### Sub-recurso paginado por ID

```
data/raw/deputados_despesas/<YYYY-MM-DDTHH-MM-SSZ>_<deputado_id>.json
```

---

## Estrutura de Diretorios

```
data/raw/
├── deputados/                    # GET /deputados (listagem)
├── partidos/                     # GET /partidos (listagem)
├── proposicoes/                  # GET /proposicoes (listagem)
├── votacoes/                     # GET /votacoes (listagem)
├── deputados_despesas/           # GET /deputados/{id}/despesas (por deputado)
├── votacoes_orientacoes/         # GET /votacoes/{id}/orientacoes (roadmap)
├── votacoes_votos/               # GET /votacoes/{id}/votos (bridge de votos)
└── proposicoes_autores/          # GET /proposicoes/{id}/autores (bridge de autoria)
```

---

## Requisitos

- **R1:** Raw JSON persistido em disco ANTES de qualquer transformacao ou carga
- **R2:** Nunca sobrescrever — usar timestamp UTC no nome do arquivo
- **R3:** Retry exponencial em erros transitórios: 5xx, 429, timeout, ConnectionError (3 tentativas, backoff 2s/4s/8s)
- **R4:** 4xx (exceto 429) = erro permanente — abortar com log claro
- **R5:** Falha de um item nao derrruba o lote — logar e continuar
- **R6:** Paginacao completa — seguir `links.rel == "next"` ate esgotar
- **R7:** Log obrigatorio: endpoint, params, nr paginas, nr itens, caminho do arquivo
- **R8:** Max 4 workers paralelos (ThreadPoolExecutor) para sub-recursos por ID
- **R9:** `User-Agent` identificavel configurado no cliente HTTP
- **R10:** Timeout configurado explicitamente em toda chamada HTTP

---

## Restricoes

- Concorrencia maxima: 4 workers (respeitar API publica)
- Honrar header `Retry-After` se presente
- Nunca logar segredos (DATABASE_URL, OPENAI_API_KEY)
- Nenhuma dependencia fora de `requirements.txt`

---

## Endpoints Roadmap (pos-V1)

| Endpoint | Valor |
|----------|-------|
| `GET /eventos` | Agenda parlamentar, dashboards |
| `GET /orgaos` | Analise por comissao |
| `GET /legislaturas` | Analise historica |
| `GET /frentes`, `/blocos` | Articulacao parlamentar |
| `GET /referencias/*` | Tabelas de dominio |

---

## Checklist para nova funcao de extracao

- [ ] Tem janela `dataInicio`/`dataFim` explicita (se aplicavel)
- [ ] Tem `ano`/`idLegislatura` explicito em `/despesas` (se aplicavel)
- [ ] Usa `save_raw` (paginado) ou `save_one` (recurso unico) corretamente
- [ ] Salva em `data/raw/<entidade>[_<subrecurso>]/<timestamp>[_<id>].json`
- [ ] Loga endpoint, params, nr paginas, nr itens, caminho
- [ ] Erros 4xx sobem; 5xx e timeout tem retry
- [ ] Sem `print()` (usar `log.info/debug`)
- [ ] Sem segredo em codigo
- [ ] Type hints em funcoes publicas

---

## Changelog

- 1.4 (2026-06-14): Endpoints de autoria (/proposicoes/{id}/autores), detalhe e votos (/votacoes/{id}, /votos) promovidos a implementados via bridges (src/bridge/); diretorios proposicoes_autores/ e votacoes_votos/ ativos
- 1.3 (2026-05-17): Revisao completa; alinhado com Sprint 2 concluido; armadilhas de defaults documentadas
- 1.2 (2026-05-15): Sub-recursos adicionados (despesas, profissoes, ocupacoes)
- 1.0 (2026-05-15): Versao inicial
