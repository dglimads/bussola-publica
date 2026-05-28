# CLAUDE.md — Bussola Publica

Guia de contexto para o Claude Code e para qualquer desenvolvedor que entrar no projeto.

---

## 1. O que e este projeto

Pipeline ETL + IA que extrai dados diarios da API da Camara dos Deputados, transforma, persiste em PostgreSQL (Supabase) e enriquece com IA generativa.

**Entregavel:** Projeto integrador da Pos-Tech Engenharia de Dados Xperiun
**Prazo:** 13/Mai/2026 → 15/Jun/2026

---

## 2. Status das Sprints

| Sprint | Escopo | Status |
|--------|--------|--------|
| Sprint 1 | Exploracao da API, cliente HTTP com retry/paginacao | Concluido |
| Sprint 2 | Transformacao (Pandas), carga (SQLAlchemy/PostgreSQL), despesas CEAP | Concluido |
| Sprint 3 | IA: embeddings, classificacao tematica, resumo executivo (OpenAI) | Implementado |

**Banco ao vivo (Supabase):** projeto `yipwbjexekvrqgnpvjfn`
**Dados carregados:** 21 partidos, 513 deputados, 100 proposicoes, 100 votacoes, ~187k despesas CEAP

---

## 3. Prerequisitos

- Python 3.14+ (venv em `.venv/`)
- Conta no Supabase (free tier serve para desenvolvimento)
- Chave OpenAI com hard cap configurado (apenas Sprint 3)

---

## 4. Setup inicial (OBRIGATORIO antes de rodar qualquer coisa)

### 4.1 Instalar dependencias

```bash
# Ativar venv (Windows)
.venv\Scripts\activate

# Instalar (usar --only-binary :all: por causa do Python 3.14)
pip install --only-binary :all: -r requirements.txt
```

### 4.2 Configurar variaveis de ambiente

```bash
# Copiar o template
copy .env.example .env

# Abrir e preencher .env com seus valores
# Campo OBRIGATORIO para Sprint 2+: DATABASE_URL
```

**O arquivo `.env` NUNCA vai para o Git** (ja esta no `.gitignore`).

### 4.3 Configurar banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Em "Database" > "Connection string" > copie a URL
3. Cole em `.env` como `DATABASE_URL=postgresql://postgres:...`
4. Acesse "SQL Editor" e execute:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;  -- necessario para Sprint 3
   ```
5. Execute o schema: cole o conteudo de `sql/schema.sql` no SQL Editor
6. Execute as seeds: cole o conteudo de `sql/seeds_temas.sql`

---

## 5. Ordem de execucao

Execute nesta ordem para uma carga completa do zero:

```
1. python scripts/explore_api.py                    # Sprint 1: valida conectividade
2. python scripts/run_extraction.py                 # Sprint 2: extrai raw data
3. python scripts/run_pipeline.py --apenas-carga    # Sprint 2: transforma + carrega
4. python scripts/run_ai_enrichment.py --limite 100 # Sprint 3: enriquecimento IA
```

Ou pipeline completo (extrai + transforma + carrega):
```
python scripts/run_pipeline.py
```

Com despesas CEAP (lento, ~500 chamadas HTTP, ~20min):
```
python scripts/run_extraction.py --incluir-despesas --ano-despesas 2025
python scripts/run_pipeline.py --apenas-carga
```

Uso incremental diario:
```
python scripts/run_pipeline.py --incremental
python scripts/run_ai_enrichment.py --limite 50
```

---

## 6. Estrutura de pastas

```
bussola-publica/
├── CLAUDE.md                    <- voce esta aqui
├── .env.example                 <- template de variaveis (copie para .env)
├── .env                         <- seus segredos (NUNCA commitar)
├── .gitignore
├── README.md
├── requirements.txt
│
├── specs/                       <- SDD: especificacoes formais (fonte da verdade para IA)
│   ├── README.md                <- guia do SDD workflow
│   ├── data-model.md            <- schema estrela completo (tabelas, PKs, FKs)
│   ├── extract.md               <- regras de extracao da API
│   ├── transform.md             <- regras de transformacao e carga
│   ├── ai-enrichment.md         <- pipeline IA: embedding, classificacao, resumo
│   └── orchestration.md         <- workflow n8n: cron, alertas
│
├── data/
│   ├── raw/                     <- JSONs brutos da API (git-ignored)
│   │   ├── deputados/
│   │   ├── partidos/
│   │   ├── proposicoes/
│   │   ├── votacoes/
│   │   └── deputados_despesas/  <- um JSON por deputado (CEAP)
│   └── processed/
│       └── _quarentena/         <- dados com problema aguardando revisao
│
├── src/
│   ├── config.py                <- config central + fail-fast
│   ├── extract/
│   │   └── camara_api.py        <- CamaraAPIClient + todos os fetch_*
│   ├── transform/
│   │   ├── partidos.py          <- raw → dim_partidos
│   │   ├── deputados.py         <- raw → dim_deputados
│   │   ├── proposicoes.py       <- raw → fato_proposicoes
│   │   ├── votacoes.py          <- raw → fato_votacoes
│   │   └── despesas.py          <- raw deputados_despesas/ → fato_despesas
│   ├── load/
│   │   └── upsert.py            <- upsert idempotente via SQLAlchemy
│   ├── utils/
│   │   └── text.py              <- limpeza de strings, strip_accents, safe_str
│   └── ai/
│       ├── embedder.py          <- gera embeddings via text-embedding-3-small
│       ├── classifier.py        <- classificacao tematica por cosseno
│       ├── summarizer.py        <- resumo executivo via gpt-4o-mini
│       └── prompts/
│           └── resumo_executivo.md  <- prompt versionado para gpt-4o-mini
│
├── scripts/
│   ├── explore_api.py           <- SPRINT 1: exploracao interativa da API
│   ├── run_extraction.py        <- SPRINT 2: apenas extracao (raw → data/raw/)
│   ├── run_pipeline.py          <- SPRINT 2+3: pipeline completo E2E
│   └── run_ai_enrichment.py     <- SPRINT 3: apenas enriquecimento IA
│
├── sql/
│   ├── schema.sql               <- DDL do modelo dimensional (rodar 1x no Supabase)
│   └── seeds_temas.sql          <- 10 temas iniciais de dim_temas
│
├── notebooks/
│   └── 01_exploracao_api.ipynb  <- exploracao interativa do Sprint 1
│
├── n8n/                         <- workflows n8n (exportar do n8n Cloud)
├── docs/
│   ├── PRD.md                   <- requisitos do produto (escopo de negocio)
│   ├── AGENT_INGESTOR.md        <- system prompt detalhado para copiloto Extract
│   ├── AGENT_TRANSFORM.md       <- system prompt detalhado para copiloto Transform
│   ├── decisoes_ia.md           <- ADR: decisoes de arquitetura de IA (Sprint 3)
│   ├── custo_ia.csv             <- log de custos OpenAI (gerado automaticamente)
│   ├── prints/                  <- screenshots da exploracao e execucao
│   └── slides/                  <- slides da apresentacao final
└── .venv/                       <- ambiente virtual (git-ignored)
```

---

## 7. Variaveis de ambiente

| Variavel | Obrigatoria | Default | Descricao |
|----------|-------------|---------|-----------|
| `DATABASE_URL` | Sprint 2+ | — | PostgreSQL connection string (Supabase) |
| `CAMARA_API_BASE_URL` | Nao | `https://dadosabertos.camara.leg.br/api/v2` | URL base da API |
| `CAMARA_API_TIMEOUT_SECONDS` | Nao | `30` | Timeout HTTP em segundos |
| `CAMARA_API_PAGE_SIZE` | Nao | `100` | Itens por pagina (max da API e 100) |
| `DATA_RAW_DIR` | Nao | `./data/raw` | Pasta para JSONs brutos |
| `LOG_LEVEL` | Nao | `INFO` | DEBUG / INFO / WARNING / ERROR |
| `OPENAI_API_KEY` | Sprint 3 | — | Chave da OpenAI |

---

## 8. Modelo de dados

Esquema estrela no PostgreSQL:

```
dim_partidos ──┐
               ├──> dim_deputados ──┐
dim_temas ─────┤                   ├──> fato_proposicoes
               │                   ├──> fato_despesas (CEAP)
               └───────────────────┴──> fato_votacoes
```

- `fato_despesas`: PK = `(cod_documento, parcela)` — chave natural da CEAP
- `fato_votacoes`: PK = `votacao_id` — cabecalho de votacao (votos individuais = Sprint 3)
- `fato_proposicoes`: `tema_id` e `embedding` preenchidos pelo Sprint 3

---

## 9. Convencoes de codigo

- **Idioma:** pt-BR sem acentos em codigo Python (comments, docstrings, log messages)
- **Codificacao:** UTF-8 em todos os arquivos; JSON com `ensure_ascii=False`
- **Acentos em dados:** preservados — nao strip_accents em conteudo de negocio
- **Type hints:** obrigatorio em funcoes publicas (`from __future__ import annotations`)
- **Logs:** usar `log.info/warning/error`, nao `print()`
- **Segredos:** apenas via `.env`, nunca em codigo
- **Imports:** stdlib → third-party → src (sem circular imports)

---

## 10. Selecao de Agentes Claude

Use o agente certo para cada tarefa:

| Tarefa | Agente recomendado |
|--------|--------------------|
| Construir / depurar pipeline ETL | `bussola-pipeline-builder` |
| Codigo Python geral | `python-developer` |
| Otimizar SQL / queries | `sql-optimizer` |
| Supabase / pgvector / RLS | `supabase` KB |
| Prompt OpenAI / classificador | `llm-specialist` ou `ai-prompt-specialist` |
| Arquitetura IA / multi-agente | `genai-architect` |
| Review de codigo | `code-reviewer` |
| Explorar codebase | `codebase-explorer` |
| Slides da apresentacao | `aide-slide-builder` |

**Regra:** leia sempre a spec relevante de `specs/` antes de pedir ao agente
para modificar qualquer camada do pipeline.

---

## 11. Desenvolvimento Guiado por Spec (SDD)

Este projeto usa **Spec-Driven Development** para desenvolvimento assistido por IA.

### Principio central

> Specs sao a fonte da verdade. O codigo segue a spec — nunca o contrario.

### Fluxo obrigatorio

```
1. Identifique a spec relevante em specs/
2. Leia a spec + o codigo atual
3. Se a mudanca exige atualizar a spec, faca isso primeiro
4. Peca ao Claude para implementar seguindo a spec
5. Atualize o changelog da spec se necessario
```

### Specs disponíveis

| Spec | Descreve |
|------|---------|
| `specs/data-model.md` | Schema estrela, tabelas, PKs, FKs |
| `specs/extract.md` | Extracao da API da Camara |
| `specs/transform.md` | Transformacao Pandas + carga PostgreSQL |
| `specs/ai-enrichment.md` | Pipeline IA: embedding, classificacao, resumo |
| `specs/orchestration.md` | Workflow n8n: cron, alertas |

### Como pedir ao Claude com SDD

```
# Padrao: [leia a spec] + [o que fazer] + [onde fazer]

"Claude, leia specs/extract.md e adicione fetch_orgaos() ao CamaraAPIClient
 seguindo os padroes de paginacao e logging documentados."

"Claude, o transform de proposicoes esta fora do padrao em specs/transform.md
 (nao esta usando safe_str). Corrija src/transform/proposicoes.py."

"Claude, verifique se src/ai/ esta alinhado com specs/ai-enrichment.md
 e liste qualquer divergencia antes de propor mudancas."
```

### Adicionando nova entidade ao pipeline

1. Atualize `specs/data-model.md` com a nova tabela
2. Atualize `specs/extract.md` com o novo endpoint
3. Atualize `specs/transform.md` com as regras de transformacao
4. Crie `sql/schema.sql` (ALTER TABLE ou nova tabela)
5. Implemente: `src/extract/camara_api.py`, `src/transform/<entidade>.py`, `src/load/upsert.py`
6. Integre em `scripts/run_extraction.py` e `scripts/run_pipeline.py`
7. Valide com re-execucao idempotente (sem duplicatas)

---

## 12. Troubleshooting (erros comuns)

**`RuntimeError: DATABASE_URL nao configurada`**
→ Execute: `copy .env.example .env` e preencha `DATABASE_URL` com a connection string do Supabase.

**`ModuleNotFoundError: No module named 'pandas'`**
→ Execute: `pip install --only-binary :all: -r requirements.txt`
→ Se falhar com erro de encoding: use `pip install --only-binary :all: pandas sqlalchemy psycopg2-binary numpy`

**`FileNotFoundError: Nenhum raw de deputados`**
→ Execute a extracao primeiro: `python scripts/run_extraction.py`

**`UnicodeDecodeError` ao instalar pacotes**
→ O Python 3.14 + caminho com caracteres especiais pode causar isso.
→ Solucao: `pip install --only-binary :all: <pacote>`
