# CLAUDE.md — Bussola Publica

Guia de contexto para o Claude Code e para qualquer desenvolvedor que entrar no projeto.

---

## 1. O que e este projeto

Pipeline ETL + IA que extrai dados da API da Camara dos Deputados, transforma com
Pandas, persiste em PostgreSQL (Supabase) e enriquece com IA generativa. Os dados
sao expostos num **dashboard Next.js ao vivo** (Bussola Legislativa) e um workflow
**n8n** envia um **e-mail semanal** com o Top 5 proposicoes da semana para a equipe.

**Stack:** Python 3.14 (pandas, SQLAlchemy, OpenAI SDK) · PostgreSQL + pgvector
(Supabase) · Next.js 16 + Recharts + SWR (dashboard) · n8n (orquestracao).

**Entregavel:** Projeto integrador da Pos-Tech Engenharia de Dados Xperiun —
Data Challenge: Radar Legislativo
**Prazo:** 13/Mai/2026 → 15/Jun/2026

---

## 2. Status das Sprints

| Sprint | Escopo | Status |
|--------|--------|--------|
| Sprint 1 | Exploracao da API, cliente HTTP com retry/paginacao | Concluido |
| Sprint 2 | Transformacao (Pandas), carga (SQLAlchemy/PostgreSQL), despesas CEAP | Concluido |
| Sprint 3 | IA: embeddings, classificacao tematica, resumo executivo (OpenAI) | Concluido |
| Pos V1 | Autoria N:N (ponte) + votos nominais + heatmap tema x partido | Concluido (migration aplicada, bridges rodando) |
| Entrega | Dashboard Next.js ao vivo + workflow n8n de e-mail semanal | Concluido |

**Banco ao vivo (Supabase):** projeto `yipwbjexekvrqgnpvjfn`

**Dados carregados (estado atual):**

| Entidade | Volume | Observacao |
|----------|--------|------------|
| `dim_partidos` | 21 | |
| `dim_deputados` | 523 | |
| `dim_temas` | 10 | seeds |
| `fato_proposicoes` | 1.550 | 1.550 com embedding/resumo, 1.467 com tema |
| `fato_votacoes` | 100 | 100 com votos processados |
| `fato_votacao_votos` | 480 | votos nominais (votacoes simbolicas retornam 0) |
| `ponte_proposicao_autores` | 519 | autoria de 500 proposicoes (rodar o bridge mais vezes para cobrir as 1.550) |
| `fato_despesas` | ~145,5k | CEAP 2025 (pipeline isolado) |

**Frente em andamento:** o bridge de autoria processa 500 proposicoes por execucao
(`--limit` default). Repetir `python scripts/4_run_authors_bridge.py --only-missing`
ate `alvos: 0` para cobrir as 1.550.

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
7. Execute a migration de autoria/votos: cole o conteudo de
   `sql/migration_autoria_votos.sql` — cria a ponte N:N, `fato_votacao_votos`,
   `pipeline_erros`, colunas auxiliares e as views agregadas. E idempotente e
   necessaria para os bridges (scripts 4 e 5) e para o dashboard.

---

## 5. Ordem de execucao

Os scripts sao numerados na ordem de execucao para nao se perder:

```
   python scripts/explore_api.py                      # Sprint 1: valida conectividade (utilitario)
1. python scripts/1_run_extraction.py                 # Sprint 2: extrai raw data
2. python scripts/2_run_pipeline.py --apenas-carga    # Sprint 2: transforma + carrega
3. python scripts/3_run_ai_enrichment.py --limite 100 # Sprint 3: enriquecimento IA
4. python scripts/4_run_authors_bridge.py --only-missing  # pos V1: ponte proposicao<->autor
5. python scripts/5_run_votes_bridge.py --only-missing    # pos V1: votos nominais
6. python scripts/6_run_despesas.py --ano 2025            # despesas CEAP (lento, por ultimo)
```

Ou pipeline completo (extrai + transforma + carrega + autoria + votos):
```
python scripts/2_run_pipeline.py --with-authors --with-votes
```

Despesas CEAP (lento, ~500 chamadas HTTP + ~145k linhas, ~20min): pipeline
proprio, fora do escopo do Radar Legislativo. Rode por ULTIMO, sem travar os demais:
```
python scripts/6_run_despesas.py --ano 2025
```

Uso incremental diario:
```
python scripts/2_run_pipeline.py --incremental --with-authors --with-votes
python scripts/3_run_ai_enrichment.py --limite 50
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
│   └── orchestration.md         <- workflow n8n: e-mail semanal (Top 5)
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
│   │   ├── despesas.py          <- raw deputados_despesas/ → fato_despesas
│   │   ├── autores.py           <- payload autores → registros da ponte (mapeamento puro)
│   │   └── votos.py             <- payload votos → registros de voto (mapeamento puro)
│   ├── load/
│   │   └── upsert.py            <- upsert idempotente via SQLAlchemy (inclui ponte/votos/flags)
│   ├── bridge/                  <- orquestracao dos bridges (pos V1)
│   │   ├── autores.py           <- run_authors_bridge: fetch+transform+upsert da ponte N:N
│   │   └── votos.py             <- run_votes_bridge: vinculo votacao->proposicao + votos nominais
│   ├── utils/
│   │   └── text.py              <- limpeza de strings, strip_accents, safe_str
│   └── ai/
│       ├── embedder.py          <- gera embeddings via text-embedding-3-small
│       ├── classifier.py        <- classificacao tematica por cosseno
│       ├── summarizer.py        <- resumo executivo via gpt-4o-mini
│       └── prompts/
│           └── resumo_executivo.md  <- prompt versionado para gpt-4o-mini
│
├── scripts/                     <- numerados na ordem de execucao
│   ├── explore_api.py           <- SPRINT 1: exploracao interativa da API (utilitario)
│   ├── 1_run_extraction.py      <- SPRINT 2: apenas extracao (raw → data/raw/)
│   ├── 2_run_pipeline.py        <- SPRINT 2+3: pipeline completo E2E (+ --with-authors/--with-votes)
│   ├── 3_run_ai_enrichment.py   <- SPRINT 3: apenas enriquecimento IA
│   ├── 4_run_authors_bridge.py  <- POS V1: popula ponte_proposicao_autores
│   ├── 5_run_votes_bridge.py    <- POS V1: popula fato_votacao_votos + vinculo votacao->proposicao
│   ├── 6_run_despesas.py        <- DESPESAS: pipeline isolado de CEAP (extrai+carrega, rodar por ultimo)
│   └── trigger_server.py        <- servidor HTTP para acionar via n8n (utilitario)
│
├── sql/
│   ├── schema.sql                  <- DDL do modelo dimensional (rodar 1x no Supabase)
│   ├── migration_autoria_votos.sql <- POS V1: ponte N:N, votos nominais, views agregadas
│   └── seeds_temas.sql             <- 10 temas iniciais de dim_temas
│
├── notebooks/
│   └── 01_exploracao_api.ipynb  <- exploracao interativa do Sprint 1
│
├── dashboard/                   <- painel Next.js 16 (Bussola Legislativa, le o Supabase ao vivo)
│   ├── app/                     <- App Router + globals.css (tema/cores-raiz)
│   ├── components/sections/     <- Visao Geral, Radar Tematico, Atividade, Votacoes, ...
│   └── lib/                     <- queries.ts (views), types.ts, equipe.ts, projeto.ts
├── presentation/                <- apresentacoes HTML (p1-arquitetura, p2-resultados)
├── n8n/
│   └── bussola_email_semanal.json  <- workflow: e-mail semanal Top 5 para a equipe
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

Esquema estrela no PostgreSQL (8 tabelas):

```
dim_partidos ──┐
               ├──> dim_deputados ──┬──> fato_despesas (CEAP)
dim_temas ─────┤                   ├──> fato_votacao_votos ──┐
               │                   │                         │
               ├──> fato_proposicoes ──> ponte_proposicao_autores (N:N)
               └──> fato_votacoes  <───────────────────────────┘
```

- `fato_despesas`: PK = `(cod_documento, parcela)` — chave natural da CEAP
- `fato_votacoes`: PK = `votacao_id` — cabecalho de votacao; `proposicao_id`/`qtd_votos` preenchidos pelo bridge de votos
- `fato_votacao_votos`: voto nominal por deputado — chave `(votacao_id, deputado_id)`, alimentada por `/votacoes/{id}/votos`
- `ponte_proposicao_autores`: relacao N:N proposicao<->autor (roadmap pos V1); a coluna legada `fato_proposicoes.autor_id` NAO e mais a base analitica
- `fato_proposicoes`: `tema_id`/`embedding`/`resumo_executivo` preenchidos pela IA; `autores_carregados`/`qtd_autores`/`autor_principal_*` pelo bridge de autoria

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
| `specs/orchestration.md` | Workflow n8n: e-mail semanal (Top 5 da semana) |

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
6. Integre em `scripts/1_run_extraction.py` e `scripts/2_run_pipeline.py`
7. Valide com re-execucao idempotente (sem duplicatas)

---

## 12. Troubleshooting (erros comuns)

**`RuntimeError: DATABASE_URL nao configurada`**
→ Execute: `copy .env.example .env` e preencha `DATABASE_URL` com a connection string do Supabase.

**`ModuleNotFoundError: No module named 'pandas'`**
→ Execute: `pip install --only-binary :all: -r requirements.txt`
→ Se falhar com erro de encoding: use `pip install --only-binary :all: pandas sqlalchemy psycopg2-binary numpy`

**`FileNotFoundError: Nenhum raw de deputados`**
→ Execute a extracao primeiro: `python scripts/1_run_extraction.py`

**`UnicodeDecodeError` ao instalar pacotes**
→ O Python 3.14 + caminho com caracteres especiais pode causar isso.
→ Solucao: `pip install --only-binary :all: <pacote>`
