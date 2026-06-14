# Spec: Transformacao e Carga — Bussola Publica

**Status:** active
**Versao:** 1.2
**Ultima atualizacao:** 2026-06-14
**Implementacao:** `src/transform/`, `src/load/upsert.py`, `src/bridge/`, `scripts/2_run_pipeline.py`, `scripts/6_run_despesas.py`
**Agent detalhado:** `docs/AGENT_TRANSFORM.md`

---

## Contexto

Camada responsavel por ler os JSONs brutos de `data/raw/`, limpar, tipar,
normalizar e carregar no PostgreSQL (Supabase) via upsert idempotente.

**Mandato:** "Limpo, tipado, sem duplicatas, na ordem certa de FK."

---

## Pipeline de Execucao

```
data/raw/<entidade>/<timestamp>.json
        |
        v
[transform_<entidade>(raw) -> pd.DataFrame]   # src/transform/<entidade>.py
        |
        v
[upsert_<entidade>(df, engine)]               # src/load/upsert.py
        |
        v
PostgreSQL (Supabase)
```

---

## Ordem Obrigatoria de Carga (FK)

```
--- nucleo do Radar Legislativo (upsert_all, via 2_run_pipeline.py) ---
1. dim_partidos
2. dim_deputados      (FK: partido_id)
3. fato_proposicoes   (FK: autor_id -> deputado_id, legado)
4. fato_votacoes      (FK: proposicao_id -> proposicao_id)
--- bridges (rodam por ultimo, sobre dados ja carregados) ---
5. ponte_proposicao_autores   (via 4_run_authors_bridge.py)
6. fato_votacao_votos         (via 5_run_votes_bridge.py)
--- despesas (pipeline proprio, fora do escopo; via 6_run_despesas.py) ---
7. fato_despesas      (FK: deputado_id)
```

Nunca alterar a ordem 1-4. Violacao de FK aborta a carga. Os bridges (5-6) sao
idempotentes e processam apenas o que ainda nao foi carregado (`--only-missing`).
`fato_despesas` (7) tambem so depende de `dim_deputados`, mas e carregada
isoladamente pelo `6_run_despesas.py` por ser a etapa mais lenta (~145k linhas) e
fora do escopo do Radar Legislativo -- `upsert_all` a pula por padrao
(`incluir_despesas=False`).

---

## Regras por Entidade

### dim_partidos

| Campo API (camelCase) | Campo schema (snake_case) | Tipo pandas | Transformacao |
|----------------------|--------------------------|-------------|---------------|
| `id` | `partido_id` | Int64 | `pd.to_numeric(errors="coerce")` |
| `sigla` | `sigla` | str | `safe_str()` |
| `nome` | `nome` | str | `clean_text(safe_str())` |

Arquivo lido: arquivo mais recente em `data/raw/partidos/` sem underscore no nome.

### dim_deputados

| Campo API | Campo schema | Tipo | Transformacao |
|-----------|-------------|------|---------------|
| `id` | `deputado_id` | Int64 | `pd.to_numeric` |
| `ultimoStatus.nome` | `nome` | str | `clean_text(safe_str())` |
| `nomeCivil` | `nome_civil` | str | `safe_str()` |
| `ultimoStatus.nomeEleitoral` | `nome_eleitoral` | str | `safe_str()` |
| `ultimoStatus.siglaPartido` | `sigla_partido` | str | `safe_str()` — lookup FK |
| `ultimoStatus.siglaUf` | `uf` | str | `safe_str()` |
| `ultimoStatus.email` | `email` | str/None | `safe_str()` |
| `uri` | `uri` | str | `safe_str()` |
| `ultimoStatus.urlFoto` | `url_foto` | str | `safe_str()` |
| *(fixo)* | `situacao` | str | `"Em exercicio"` |

`sigla_partido` e resolvida para `partido_id` via lookup no banco apos transform.

### fato_proposicoes

| Campo API | Campo schema | Tipo | Transformacao |
|-----------|-------------|------|---------------|
| `id` | `proposicao_id` | Int64 | `pd.to_numeric` |
| `dataApresentacao` | `data_apresentacao` | date | `pd.to_datetime(..., errors="coerce").dt.date` |
| `siglaTipo` | `tipo` | str | `safe_str()` |
| `ementa` | `ementa` | str | `clean_text(safe_str())` — preservar acentos |
| *(nulo)* | `autor_id` | None | LEGADO — autoria real e N:N (bridge -> ponte) |
| *(nulo)* | `tema_id` | None | Preenchido pelo Sprint 3 IA |

Agrega TODOS os arquivos em `data/raw/proposicoes/`.

### fato_votacoes

| Campo API | Campo schema | Tipo | Transformacao |
|-----------|-------------|------|---------------|
| `id` | `votacao_id` | str | `.astype(str)` — formato "NNNN-NN" |
| `dataHoraInicio` | `data` | datetime | `pd.to_datetime` |
| `siglaOrgao` | `orgao` | str/None | `safe_str()` |
| `descricao` | `descricao` | str/None | `clean_text(safe_str())` |
| `aprovacao` | `aprovacao` | bool/None | mapa `{1: True, 0: False, None: None}` |
| *(nulo)* | `proposicao_id` | None | Resolvido pelo bridge de votos via `/votacoes/{id}` |

Agrega TODOS os arquivos em `data/raw/votacoes/`.

### fato_despesas

| Campo API | Campo schema | Tipo | Transformacao |
|-----------|-------------|------|---------------|
| `codDocumento` | `cod_documento` | str | `.astype(str)` — PK natural |
| `parcela` | `parcela` | Int64 | `pd.to_numeric` — PK natural |
| *(de _meta.endpoint)* | `deputado_id` | Int64 | extraido de `/deputados/<ID>/despesas` |
| `ano` | `ano` | Int64 | `pd.to_numeric` |
| `mes` | `mes` | Int64 | `pd.to_numeric` |
| `tipoDespesa` | `tipo_despesa` | str | `safe_str()` |
| `valorDocumento` | `valor_documento` | float | `pd.to_numeric(errors="coerce")` |
| `valorLiquido` | `valor_liquido` | float | `pd.to_numeric(errors="coerce")` |
| `valorGlosa` | `valor_glosa` | float | `pd.to_numeric(errors="coerce")` |
| `nomeFornecedor` | `fornecedor_nome` | str | `safe_str()` |
| `cnpjCpfFornecedor` | `fornecedor_cnpj` | str | `normalize_cnpj_cpf()` |
| `numDocumento` | `num_documento` | str | `safe_str()` |
| `urlDocumento` | `url_documento` | str | `safe_str()` |

Agrega TODOS os arquivos em `data/raw/deputados_despesas/`.
`deputado_id` extraido via regex de `_meta.endpoint`:
`/deputados/220714/despesas` → `220714`

### ponte_proposicao_autores (bridge de autoria)

Mapeamento puro em `src/transform/autores.py` (`map_author`); orquestracao em
`src/bridge/autores.py`. Le `/proposicoes/{id}/autores`.

| Campo API | Campo schema | Transformacao |
|-----------|-------------|---------------|
| `uri` | `autor_id` | id numerico do fim da uri (se terminar em numero) |
| `tipo` | `autor_tipo` | `safe_str()` — preservado ("Deputado", "Partido", ...) |
| *(derivado)* | `deputado_id` | `autor_id` quando tipo=Deputado |
| *(derivado)* | `partido_id` | `autor_id` quando tipo=Partido |
| `nome` | `nome_autor` | `clean_text(safe_str())` (fallback "(sem nome)") |
| `codTipo` | `cod_tipo_autor` | int |
| `ordemAssinatura` | `ordem_assinatura` | int |
| `proponente` | `proponente` | `normalize_bool` (1/0 → bool) |

Autor principal: `proponente=true` > menor `ordem_assinatura` > primeiro item.
Desnormaliza para `fato_proposicoes.autor_principal_*` + `autores_carregados`/`qtd_autores`.

### fato_votacao_votos (bridge de votos)

Mapeamento puro em `src/transform/votos.py` (`map_vote`); orquestracao em
`src/bridge/votos.py`. Le `/votacoes/{id}/votos`.

| Campo API | Campo schema | Transformacao |
|-----------|-------------|---------------|
| `deputado_.id` | `deputado_id` | int (a API usa `deputado_` com underscore) |
| `tipoVoto` | `tipo_voto` | `clean_text(safe_str())` |
| `deputado_.siglaPartido` | `sigla_partido_voto` | `safe_str()` — partido NO MOMENTO do voto |
| `deputado_.siglaUf` | `sigla_uf_voto` | `safe_str()` |
| `dataRegistroVoto` | `data_registro_voto` | string ISO → CAST timestamptz no load |

Votos sem `deputado_id` sao descartados (logados). Lista vazia = votacao simbolica (normal).

---

## Estrategia de Upsert

| Tabela | PK | Em conflito: atualiza | Em conflito: preserva (COALESCE) |
|--------|----|-----------------------|----------------------------------|
| `dim_partidos` | `partido_id` | `sigla, nome, ingested_at` | — |
| `dim_deputados` | `deputado_id` | `nome, nome_civil, nome_eleitoral, partido_id, uf, situacao, email, uri, url_foto, ingested_at` | — |
| `fato_proposicoes` | `proposicao_id` | `data_apresentacao, tipo, ementa, ingested_at` | `tema_id`, `embedding`, `resumo_executivo` |
| `fato_votacoes` | `votacao_id` | `data, orgao, descricao, aprovacao, ingested_at` | `proposicao_id` (se ja resolvido) |
| `fato_despesas` | `(cod_documento, parcela)` | `valor_documento, valor_liquido, valor_glosa, tipo_despesa, ingested_at` | `fornecedor_nome, fornecedor_cnpj` |
| `ponte_proposicao_autores` | `(proposicao_id, autor_tipo, nome_autor, COALESCE(uri_autor,''))` | `autor_id, deputado_id, partido_id, proponente, raw_payload` | — |
| `fato_votacao_votos` | `(votacao_id, deputado_id)` | `tipo_voto, sigla_partido_voto, sigla_uf_voto, data_registro_voto, raw_payload` | — |

---

## Utilitarios Obrigatorios (`src/utils/text.py`)

| Funcao | Quando usar |
|--------|-------------|
| `safe_str(value)` | Todo campo string — trata None, 'nan', '', float NaN |
| `clean_text(text, max_len)` | Campos de texto longo — remove ctrl chars, normaliza espacos |
| `strip_accents(text)` | Apenas em chaves/slugs Python — NUNCA em dados de negocio |
| `normalize_cnpj_cpf(doc)` | Campo `fornecedor_cnpj` — remove `.`, `-`, `/`, espacos |

---

## Requisitos

- **R1:** `df = df.copy()` antes de qualquer modificacao — nunca alterar o raw
- **R2:** Verificar se coluna existe antes de usar: `if col in df.columns`
- **R3:** `dropna(subset=["pk_col"])` antes do upsert — nunca carregar linha sem PK
- **R4:** `drop_duplicates(subset=["pk_col"])` antes do upsert
- **R5:** `df.reset_index(drop=True)` no retorno de todo transform
- **R6:** Todos os IDs como `Int64` (nullable) — nunca `int64` puro
- **R7:** Todos os upserts usam `ON CONFLICT DO UPDATE SET` — nunca INSERT puro
- **R8:** Campos IA em `fato_proposicoes` usam COALESCE — nunca sobrescrever
- **R9:** `engine.begin()` com context manager — nunca `engine.execute()` (deprecated SQLAlchemy 2.x)
- **R10:** `open(..., encoding="utf-8")` em todos os arquivos
- **R11:** `json.dumps(..., ensure_ascii=False)` — preservar acentos nos dados

---

## Restricoes

- Nao criar ou alterar schema do banco — usar apenas `sql/schema.sql`
- Nao chamar a API — isso e papel da camada Extract
- Nao classificar temas nem gerar embeddings — isso e Sprint 3
- Nao usar `df.to_sql()` do pandas — usar `sqlalchemy.text()` com dicts
- Instalar com `--only-binary :all:` no Windows (caminho com acentos)

---

## Checklist para nova funcao de transform/load

- [ ] Le o JSON correto (lista vs detalhe, mais recente vs todos)
- [ ] `df = df.copy()` antes de modificar
- [ ] Verifica colunas antes de usar
- [ ] Renomeia camelCase para snake_case
- [ ] Aplica `safe_str()` e `clean_text()` nos campos texto
- [ ] Tipos corretos (Int64 para IDs, float para valores, date para datas)
- [ ] `dropna(subset=["pk_col"])` antes do upsert
- [ ] `drop_duplicates(subset=["pk_col"])` antes do upsert
- [ ] `reset_index(drop=True)` no retorno
- [ ] Loga contagem: `log.info("X entidade: %d registros", len(df))`
- [ ] Upsert usa ON CONFLICT DO UPDATE
- [ ] Campos IA usam COALESCE
- [ ] Testado com `2_run_pipeline.py --apenas-carga` sem erros

---

## Changelog

- 1.2 (2026-06-14): Despesas CEAP desacopladas -> upsert_all pula fato_despesas por padrao (incluir_despesas=False); carga de despesas movida para pipeline proprio scripts/6_run_despesas.py
- 1.1 (2026-06-14): Regras de mapeamento de autoria (ponte N:N) e votos nominais; bridges em src/bridge/; upsert da ponte e de fato_votacao_votos
- 1.0 (2026-05-17): Versao inicial — distillada de AGENT_TRANSFORM.md e Sprint 2 concluido
