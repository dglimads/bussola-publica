# Spec: Modelo de Dados — Bussola Publica

**Status:** active
**Versao:** 2.0
**Ultima atualizacao:** 2026-05-17
**Implementacao:** `sql/schema.sql`, `sql/seeds_temas.sql`

---

## Contexto

Esquema estrela em PostgreSQL (Supabase) para analise de atividade parlamentar
brasileira com enriquecimento por IA generativa.
Alimentado diariamente pela API publica da Camara dos Deputados.

---

## Diagrama

```
dim_partidos ──┐
               ├──► dim_deputados ──┐
dim_temas ─────┤                   ├──► fato_proposicoes (+ VECTOR(1536) pgvector)
               │                   ├──► fato_despesas (CEAP)
               └───────────────────┴──► fato_votacoes
```

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
| `autor_id` | INTEGER | FK dim_deputados (nullable) | Autor principal; NULL se N:N ou externo |
| `tema_id` | INTEGER | FK dim_temas (nullable) | Preenchido pelo classificador IA |
| `embedding` | VECTOR(1536) | | Vetor semantico da ementa (pgvector) |
| `resumo_executivo` | TEXT | | Resumo 3 linhas gerado por gpt-4o-mini |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/proposicoes/<timestamp>.json`

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
| `proposicao_id` | INTEGER | FK fato_proposicoes (nullable) | NULL ate resolucao fuzzy (Sprint 3+) |
| `data` | TIMESTAMPTZ | | Data e hora da votacao |
| `orgao` | TEXT | | Sigla do orgao (PLEN, CCJC, etc.) |
| `descricao` | TEXT | | Descricao da pauta |
| `aprovacao` | BOOLEAN | | TRUE=aprovado, FALSE=rejeitado, NULL=inconclusivo |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | |

Arquivo raw: `data/raw/votacoes/<timestamp>.json`

**Nota:** `proposicao_id` fica NULL no Sprint 2. A API retorna texto livre
("PL 1234/2025"), nao ID. Resolucao via fuzzy match: roadmap Sprint 3+.

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
- **R4:** Ordem de carga respeita FKs: `dim_partidos` → `dim_deputados` → `fato_proposicoes` → `fato_votacoes` → `fato_despesas`
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

- [ ] Tabela `ponte_proposicao_autores (proposicao_id, deputado_id, tipo_autor, ordem)` para N:N — roadmap pos-V1
- [ ] Resolucao de `proposicao_id` em `fato_votacoes` via fuzzy match — Sprint 3+
- [ ] Indices pgvector (IVFFlat ou HNSW) para busca semantica em producao

---

## Changelog

- 2.0 (2026-05-17): PK de fato_despesas alterada para (cod_documento, parcela); dim_deputados com nome_civil, nome_eleitoral, uri, url_foto; campos de custo CEAP expandidos; embedding e resumo_executivo adicionados em fato_proposicoes
- 1.0 (2026-05-15): Versao inicial baseada no PRD §9
