# Spec: Modelo de Dados — Bussola Publica

**Status:** active
**Versao:** 3.0
**Ultima atualizacao:** 2026-06-14
**Implementacao:** `sql/schema.sql`, `sql/migration_autoria_votos.sql`, `sql/seeds_temas.sql`

---

## Contexto

Esquema estrela em PostgreSQL (Supabase) para analise de atividade parlamentar
brasileira com enriquecimento por IA generativa.
Alimentado diariamente pela API publica da Camara dos Deputados.

---

## Diagrama

```
dim_partidos ──┐
               ├──► dim_deputados ──┬──► fato_despesas (CEAP)
dim_temas ─────┤                   ├──► fato_votacao_votos
               │                   │
               ├──► fato_proposicoes (+ VECTOR(1536) pgvector)
               │         │
               │         └──► ponte_proposicao_autores (N:N proposicao<->autor)
               └──► fato_votacoes ──► fato_votacao_votos
```

8 tabelas: 3 dimensoes (`dim_partidos`, `dim_deputados`, `dim_temas`),
4 fatos (`fato_proposicoes`, `fato_votacoes`, `fato_votacao_votos`, `fato_despesas`)
e 1 ponte N:N (`ponte_proposicao_autores`). Tabela auxiliar: `pipeline_erros`.

---

## Tabelas

### dim_partidos

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `partido_id` | INTEGER | PK | ID numerico da API da Camara |
| `sigla` | TEXT | NOT NULL | Ex: PT, PL, MDB, UNION |
| `nome` | TEXT | | Nome completo do partido |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | Ultima vez carregado |

Arquivo raw: `data/raw/partidos/<timestamp>.json`

---

### dim_deputados

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `deputado_id` | INTEGER | PK | ID numerico da API da Camara |
| `nome` | TEXT | NOT NULL | Nome parlamentar (ultimoStatus.nome) |
| `nome_civil` | TEXT | | Nome de nascimento (nomeCivil) |
| `nome_eleitoral` | TEXT | | Nome na urna (ultimoStatus.nomeEleitoral) |
| `partido_id` | INTEGER | FK dim_partidos | Partido atual |
| `uf` | CHAR(2) | | Estado de representacao |
| `situacao` | TEXT | | "Em exercicio" (fixo na carga atual) |
| `email` | TEXT | | Email parlamentar oficial |
| `uri` | TEXT | | URL do recurso na API |
| `url_foto` | TEXT | | Foto oficial |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/deputados/<timestamp>.json`

---

### dim_temas

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `tema_id` | SERIAL | PK | |
| `nome` | TEXT | UNIQUE NOT NULL | Nome do tema (usado no embedding) |
| `descricao` | TEXT | | Descricao expandida para melhorar embedding |
| `critico` | BOOLEAN | DEFAULT FALSE | Se TRUE: gera alerta no n8n |

**Temas iniciais (seeds):**

| Nome | critico |
|------|---------|
| Saude | true |
| Tributario | true |
| Trabalho | true |
| Tecnologia e IA | true |
| Economia | true |
| Meio Ambiente | false |
| Seguranca Publica | false |
| Educacao | false |
| Direitos Humanos | false |
| Infraestrutura | false |

Populado via `sql/seeds_temas.sql` — rodar apenas 1x.

---

### fato_proposicoes

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `proposicao_id` | INTEGER | PK | ID numerico da API da Camara |
| `data_apresentacao` | DATE | | Data de apresentacao na Camara |
| `tipo` | TEXT | | Tipo legislativo (PL, PEC, MPV, etc.) |
| `ementa` | TEXT | | Texto da ementa (preserva acentos) |
| `autor_id` | INTEGER | FK dim_deputados (nullable) | LEGADO — autoria real e N:N (ver ponte). Nao usar como base analitica |
| `tema_id` | INTEGER | FK dim_temas (nullable) | Preenchido pelo classificador IA |
| `embedding` | VECTOR(1536) | | Vetor semantico da ementa (pgvector) |
| `resumo_executivo` | TEXT | | Resumo 3 linhas gerado por gpt-4o-mini |
| `autores_carregados` | BOOLEAN | DEFAULT FALSE | TRUE apos o bridge de autoria processar a proposicao |
| `qtd_autores` | INTEGER | DEFAULT 0 | Numero de autores retornados pela API |
| `autor_principal_nome` | TEXT | | Desnormalizacao: nome do autor principal |
| `autor_principal_tipo` | TEXT | | Desnormalizacao: tipo (Deputado/Partido/...) |
| `autor_principal_deputado_id` | INTEGER | | Desnormalizacao: deputado_id do principal (se Deputado) |
| `autor_principal_partido_id` | INTEGER | | Desnormalizacao: partido_id do principal (se Partido) |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/proposicoes/<timestamp>.json`
Autores raw: `data/raw/proposicoes_autores/<timestamp>_<proposicao_id>.json`

**Regra de upsert:** em conflito de `proposicao_id`, atualiza campos ETL e
preserva campos IA com COALESCE:
- `tema_id = COALESCE(fato_proposicoes.tema_id, EXCLUDED.tema_id)`
- `embedding = COALESCE(fato_proposicoes.embedding, EXCLUDED.embedding)`
- `resumo_executivo = COALESCE(fato_proposicoes.resumo_executivo, EXCLUDED.resumo_executivo)`

---

### fato_votacoes

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `votacao_id` | TEXT | PK | ID da API (ex: "2272615-43") — nao numerico |
| `proposicao_id` | INTEGER | FK fato_proposicoes (nullable) | Resolvido pelo bridge de votos (so grava se a proposicao existe) |
| `data` | TIMESTAMPTZ | | Data e hora da votacao |
| `orgao` | TEXT | | Sigla do orgao (PLEN, CCJC, etc.) |
| `descricao` | TEXT | | Descricao da pauta |
| `aprovacao` | BOOLEAN | | TRUE=aprovado, FALSE=rejeitado, NULL=inconclusivo |
| `uri_proposicao` | TEXT | | URI da proposicao objeto (best-effort do detalhe) |
| `objeto_votacao` | TEXT | | Texto do objeto/descricao da votacao |
| `cod_tipo_votacao` | INTEGER | | Codigo do tipo de votacao (quando disponivel) |
| `votos_carregados` | BOOLEAN | DEFAULT FALSE | TRUE apos o bridge de votos processar a votacao |
| `qtd_votos` | INTEGER | DEFAULT 0 | Numero de votos nominais carregados |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/votacoes/<timestamp>.json`

**Nota:** `proposicao_id` fica NULL na carga base (a listagem retorna texto livre,
nao ID). O bridge de votos (`5_run_votes_bridge.py`) resolve o vinculo via
`/votacoes/{id}` e so grava o FK se a proposicao existir em `fato_proposicoes`.

---

### fato_votacao_votos

Voto nominal individual (grao: deputado x votacao). Alimentada por
`/votacoes/{id}/votos`. So existe para votacoes nominais e abertas.

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `id` | BIGSERIAL | PK | Surrogate |
| `votacao_id` | TEXT | FK fato_votacoes, UNIQUE(votacao_id, deputado_id) | |
| `deputado_id` | INTEGER | NOT NULL | Sem FK rigida (pode ser legislatura anterior) |
| `tipo_voto` | TEXT | | "Sim", "Nao", "Obstrucao", "Abstencao", "Artigo 17", ... |
| `sigla_partido_voto` | TEXT | | Partido NO MOMENTO do voto (pode diferir do atual) |
| `sigla_uf_voto` | TEXT | | UF no momento do voto |
| `data_registro_voto` | TIMESTAMPTZ | | |
| `raw_payload` | JSONB | | Item bruto da API |
| `criado_em` / `atualizado_em` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/votacoes_votos/<timestamp>_<votacao_id>.json`

---

### ponte_proposicao_autores (N:N)

Relacao N:N proposicao <-> autor. Uma proposicao tem varios autores (coautoria)
e um autor assina varias. Alimentada por `/proposicoes/{id}/autores`.
**Sem FK rigida** para dim_deputados/dim_partidos: o autor pode ser deputado de
legislatura anterior, comissao, Senado, Poder Executivo ou orgao.

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `id` | BIGSERIAL | PK | Surrogate |
| `proposicao_id` | INTEGER | NOT NULL | Proposicao assinada |
| `autor_id` | INTEGER | | ID cru extraido da uri |
| `autor_tipo` | TEXT | NOT NULL | "Deputado", "Partido", "Comissao", ... |
| `deputado_id` | INTEGER | | Preenchido quando autor_tipo = Deputado |
| `partido_id` | INTEGER | | Preenchido quando autor_tipo = Partido |
| `nome_autor` | TEXT | NOT NULL | |
| `cod_tipo_autor` | INTEGER | | codTipo da API |
| `ordem_assinatura` | INTEGER | | Ordem de assinatura |
| `proponente` | BOOLEAN | DEFAULT FALSE | Autor principal/proponente |
| `uri_autor` | TEXT | | URI do autor na API |
| `raw_payload` | JSONB | | Item bruto |

Chave de idempotencia (indice unico de expressao):
`(proposicao_id, autor_tipo, nome_autor, COALESCE(uri_autor, ''))`.

---

### pipeline_erros (auxiliar)

Log nao bloqueante de divergencias dos bridges (proposicao sem autores, autor
sem ID numerico, deputado autor fora de dim_deputados, erro HTTP, etc.).
Colunas: `etapa`, `entidade_tipo`, `entidade_id`, `mensagem`, `payload` JSONB, `criado_em`.

---

### fato_despesas

| Coluna | Tipo | Constraint | Descricao |
|--------|------|------------|-----------|
| `cod_documento` | TEXT | PK (composta) | Codigo do documento CEAP |
| `parcela` | INTEGER | PK (composta) | Parcela do pagamento |
| `deputado_id` | INTEGER | FK dim_deputados | |
| `ano` | SMALLINT | | Ano da despesa |
| `mes` | SMALLINT | | Mes da despesa (1-12) |
| `tipo_despesa` | TEXT | | Categoria CEAP (ex: "Combustiveis e lubrificantes") |
| `valor_documento` | NUMERIC(12,2) | | Valor bruto do comprovante |
| `valor_liquido` | NUMERIC(12,2) | | Valor apos glosa (efetivamente pago) |
| `valor_glosa` | NUMERIC(12,2) | | Valor recusado pela Mesa |
| `fornecedor_nome` | TEXT | | Nome do fornecedor |
| `fornecedor_cnpj` | TEXT | | CNPJ ou CPF sem pontuacao |
| `num_documento` | TEXT | | Numero do documento fiscal |
| `url_documento` | TEXT | | Link do comprovante (se disponivel) |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/deputados_despesas/<timestamp>_<deputado_id>.json`

`deputado_id` e extraido do campo `_meta.endpoint`:
`/deputados/220714/despesas` → `220714`

---

## Requisitos

- **R1:** Toda tabela tem `ingested_at TIMESTAMPTZ DEFAULT NOW()` para rastreabilidade de carga
- **R2:** Todo upsert usa `INSERT ... ON CONFLICT DO UPDATE SET` — nunca INSERT puro
- **R3:** Campos de IA (`tema_id`, `embedding`, `resumo_executivo`) usam COALESCE no upsert
- **R4:** Ordem de carga respeita FKs: `dim_partidos` → `dim_deputados` → `fato_proposicoes` → `fato_votacoes` → `fato_despesas`; bridges (ponte de autores, votos nominais) rodam por ultimo, sobre dados ja carregados
- **R5:** Extensao `pgvector` habilitada antes do schema: `CREATE EXTENSION IF NOT EXISTS vector`
- **R6:** Todos os IDs inteiros carregados como `Int64` (nullable) no pandas — nunca `int64` puro
- **R7:** Strings nulas da API tratadas via `safe_str()` — nunca `.fillna("")` direto

---

## Restricoes

- Supabase free tier: 500 MB storage
- `VECTOR(1536)`: alinhado com `text-embedding-3-small` — nao mudar dimensao sem migracao
- PK de `fato_despesas` e composta (cod_documento + parcela) — sem surrogate key
- `votacao_id` e TEXT (nao INTEGER) — formato "NNNN-NN" da API

---

## Open Questions

- [x] Tabela `ponte_proposicao_autores` para N:N — implementada (v3.0); requer backfill via `4_run_authors_bridge.py`
- [x] Resolucao de `proposicao_id` em `fato_votacoes` — implementada via `/votacoes/{id}` no bridge de votos (v3.0)
- [ ] Indices pgvector (IVFFlat ou HNSW) para busca semantica em producao
- [ ] Resolver `autor_principal_partido_id` para autores tipo Deputado (hoje so preenchido quando o autor e Partido)

---

## Changelog

- 3.0 (2026-06-14): ponte_proposicao_autores (N:N) + fato_votacao_votos + pipeline_erros; colunas auxiliares de autoria em fato_proposicoes e de votos em fato_votacoes; views agregadas (heatmap tema x partido, votos por partido) em sql/migration_autoria_votos.sql
- 2.0 (2026-05-17): PK de fato_despesas alterada para (cod_documento, parcela); dim_deputados com nome_civil, nome_eleitoral, uri, url_foto; campos de custo CEAP expandidos; embedding e resumo_executivo adicionados em fato_proposicoes
- 1.0 (2026-05-15): Versao inicial baseada no PRD §9
