# Bússola Pública

> **Radar Legislativo Inteligente — Pipeline ETL + IA Generativa**
> Projeto Integrador · Pós-Tech Engenharia de Dados Xperiun · Data Challenge: Radar Legislativo

![Python](https://img.shields.io/badge/Python-3.14-blue?logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql)
![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)
![Next.js](https://img.shields.io/badge/Dashboard-Next.js%2016-000000?logo=nextdotjs)
![n8n](https://img.shields.io/badge/Orquestração-n8n-EA4B71?logo=n8n)
![Status](https://img.shields.io/badge/pipeline-ao%20vivo-success)

**Em uma frase:** dados públicos da Câmara dos Deputados extraídos diariamente,
estruturados num modelo estrela, enriquecidos com IA (tema, resumo, busca semântica),
servidos num **dashboard ao vivo** e resumidos num **e-mail semanal** para a equipe.

---

## Sumário

1. [Sobre o Projeto](#1-sobre-o-projeto)
2. [Arquitetura do Pipeline](#2-arquitetura-do-pipeline)
3. [Modelo de Dados](#3-modelo-de-dados)
4. [Stack Tecnológica](#4-stack-tecnológica)
5. [Pré-Requisitos](#5-pré-requisitos)
6. [Setup Completo — Passo a Passo](#6-setup-completo--passo-a-passo)
7. [Como Executar](#7-como-executar)
8. [Camada de IA](#8-camada-de-ia)
9. [Entrega: Dashboard + Automação n8n](#9-entrega-dashboard--automação-n8n)
10. [Estrutura de Pastas](#10-estrutura-de-pastas)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Troubleshooting](#12-troubleshooting)
13. [Segurança](#13-segurança)
14. [Status dos Sprints](#14-status-dos-sprints)

---

## 1. Sobre o Projeto

### O Problema

Consultorias de Relações Governamentais monitoram **manualmente** o portal da Câmara dos Deputados. O resultado são analistas sobrecarregados, histórico fragmentado em planilhas pessoais, classificação temática inconsistente e alertas que dependem da memória humana. O custo operacional cresce linearmente com o número de clientes.

### A Solução

A **Bússola Pública** é um pipeline ETL + IA que:

| Etapa | O que faz |
|-------|-----------|
| **Extract** | Extrai via API pública da Câmara (`dadosabertos.camara.leg.br/api/v2`) com retry e paginação |
| **Transform** | Valida, tipifica e deduplica com Pandas |
| **Load** | Persiste em PostgreSQL (Supabase) num modelo dimensional estrela de 8 tabelas |
| **Bridge** | Resolve a autoria N:N (proposição↔autor) e os votos nominais por deputado |
| **Enrich** | Classifica proposições por tema (embeddings + cosseno) e gera resumos executivos (GPT-4o-mini) |
| **Serve** | Dashboard Next.js lê o banco ao vivo; n8n envia um e-mail semanal com o Top 5 da semana |

### Dados Disponíveis no Banco (estado atual)

| Entidade | Registros | Observação |
|----------|-----------|------------|
| Partidos | 21 | |
| Deputados | 523 | |
| Temas | 10 | seeds |
| Proposições | 1.550 | com embedding + resumo; 1.467 com tema |
| Votações | 100 | 100 processadas pelo bridge de votos |
| Votos nominais | 480 | `fato_votacao_votos` (votações simbólicas retornam 0) |
| Autorias (ponte N:N) | 519 | de 500 proposições — rode o bridge mais vezes p/ cobrir as 1.550 |
| Despesas CEAP | ~145.500 | CEAP 2025 (pipeline isolado) |

**Banco ao vivo:** [Supabase — Bússola Pública](https://supabase.com/dashboard/project/yipwbjexekvrqgnpvjfn)

---

## 2. Arquitetura do Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FONTE: API Câmara dos Deputados (dadosabertos.camara.leg.br/api/v2)   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  GET /deputados, /partidos,
                                │  /proposicoes, /votacoes,
                                │  /deputados/{id}/despesas
                                ▼
┌───────────────── EXTRACT ─────────────────────────────────────────────┐
│  CamaraAPIClient                                                       │
│  • Paginação automática (HATEOAS links.next)                          │
│  • Retry exponencial: 3x, backoff 2s/4s/8s                            │
│  • Timeout: 30s por requisição                                         │
│  • Persistência bruta em data/raw/<entidade>/<timestamp>.json         │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  JSONs imutáveis em disco
                                ▼
┌───────────────── TRANSFORM ───────────────────────────────────────────┐
│  Pandas DataFrames                                                     │
│  • json_normalize + renomeia camelCase → snake_case                   │
│  • Tipagem: Int64 para IDs, date para datas, float para valores        │
│  • Limpeza: safe_str(), clean_text(), normalize_cnpj_cpf()            │
│  • Registros inválidos → data/processed/_quarentena/                  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  DataFrames validados
                                ▼
┌───────────────── LOAD ────────────────────────────────────────────────┐
│  SQLAlchemy + PostgreSQL (Supabase)                                    │
│  • INSERT ... ON CONFLICT DO UPDATE (upsert idempotente)              │
│  • Ordem de FK: partidos → deputados → proposições → votações         │
│  • COALESCE preserva campos de IA já preenchidos                      │
│  • Despesas CEAP: pipeline isolado (6_run_despesas.py), à parte        │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  Núcleo relacional no banco
                                ▼
┌───────────────── BRIDGE (Pós V1) ─────────────────────────────────────┐
│  Pontes que completam o modelo (idempotentes, --only-missing)          │
│  • 4_run_authors_bridge → ponte_proposicao_autores (autoria N:N)       │
│  • 5_run_votes_bridge   → fato_votacao_votos + vínculo votação→prop    │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
┌───────────────── ENRICH (IA) ─────────────────────────────────────────┐
│  OpenAI API                                                            │
│  • embedder.py   → text-embedding-3-small → VECTOR(1536) em pgvector  │
│  • classifier.py → similaridade de cosseno → tema_id                  │
│  • summarizer.py → gpt-4o-mini (T=0.2) → resumo_executivo (3 linhas)  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  Proposições enriquecidas
                                ▼
┌───────────────── SERVE (Dashboard) ───────────────────────────────────┐
│  Next.js 16 + Supabase (anon) + Recharts + SWR                        │
│  • 9 seções, leitura ao vivo das views agregadas, refresh a cada 60s   │
│  • Heatmap tema × partido, autoria por deputado, "como cada partido    │
│    votou", KPIs, busca temática                                        │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
┌───────────────── ORQUESTRAÇÃO (n8n) ──────────────────────────────────┐
│  Workflow semanal (segunda 08h BRT) — e-mail para a equipe             │
│  • Cron → Query Top 5 proposições da semana (últimos 7 dias)           │
│    ordenadas por tema crítico, depois nº de autores                    │
│  • Monta e-mail HTML e envia via SMTP aos integrantes (teste)          │
│  • Ingestão (scripts 1–6) roda à parte, manualmente                    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Dados

### Diagrama Estrela (8 tabelas)

```
dim_partidos ──┐
               ├──► dim_deputados ──┬──► fato_despesas (CEAP)
dim_temas ─────┤                   ├──► fato_votacao_votos ──┐
               │                   │     (voto nominal)      │
               ├──► fato_proposicoes ──► ponte_proposicao_autores (N:N)
               │     (embedding, resumo, tema)               │
               └──► fato_votacoes  ◄───────────────────────────┘
```

- `ponte_proposicao_autores` (N:N): o `/proposicoes` **não** traz o autor — a ponte é
  populada por `/proposicoes/{id}/autores`. É a base analítica de autoria (a coluna
  legada `fato_proposicoes.autor_id` não é mais usada).
- `fato_votacao_votos`: voto nominal por deputado, via `/votacoes/{id}/votos`.
- `pipeline_erros`: log não-bloqueante de divergências dos bridges (9ª tabela, operacional).

### Dicionário de Dados

#### `dim_partidos`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `partido_id` | INTEGER PK | ID numérico da API |
| `sigla` | TEXT NOT NULL | Ex: PT, PL, MDB |
| `nome` | TEXT | Nome completo |
| `ingested_at` | TIMESTAMPTZ | Timestamp de carga |

#### `dim_deputados`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `deputado_id` | INTEGER PK | ID numérico da API |
| `nome` | TEXT NOT NULL | Nome parlamentar |
| `nome_civil` | TEXT | Nome de nascimento |
| `nome_eleitoral` | TEXT | Nome na urna |
| `partido_id` | INTEGER FK | → `dim_partidos` |
| `uf` | CHAR(2) | Estado de representação |
| `situacao` | TEXT | Ex: Em exercício |
| `email` | TEXT | Contato oficial |
| `uri` | TEXT | URL do recurso na API |
| `url_foto` | TEXT | Foto oficial |
| `ingested_at` | TIMESTAMPTZ | Timestamp de carga |

#### `dim_temas`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `tema_id` | SERIAL PK | Auto-incremento |
| `nome` | TEXT UNIQUE | Ex: Saúde, Tributário |
| `descricao` | TEXT | Texto usado para gerar embedding do tema |
| `critico` | BOOLEAN | Se TRUE: prioriza a proposição no e-mail semanal e no painel de Alertas |

**10 temas iniciais (seeds):** Saúde ⚠️, Tributário ⚠️, Trabalho ⚠️, Tecnologia e IA ⚠️, Economia ⚠️, Meio Ambiente, Segurança Pública, Educação, Direitos Humanos, Infraestrutura

#### `fato_proposicoes`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `proposicao_id` | INTEGER PK | ID numérico da API |
| `data_apresentacao` | DATE | Data de protocolo |
| `tipo` | TEXT | PL, PEC, MPV, REQ... |
| `ementa` | TEXT | Texto oficial (com acentos) |
| `autor_id` | INTEGER FK | → `dim_deputados` (nullable) |
| `tema_id` | INTEGER FK | → `dim_temas` (preenchido pela IA) |
| `embedding` | VECTOR(1536) | Vetor semântico da ementa (pgvector) |
| `resumo_executivo` | TEXT | Resumo de 3 linhas gerado por GPT-4o-mini |
| `ingested_at` | TIMESTAMPTZ | Timestamp de carga |

#### `fato_votacoes`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `votacao_id` | TEXT PK | ID da API (formato "NNNN-NN") |
| `proposicao_id` | INTEGER FK | → `fato_proposicoes` (nullable) |
| `data` | TIMESTAMPTZ | Data e hora da votação |
| `orgao` | TEXT | Sigla do órgão (PLEN, CCJC...) |
| `descricao` | TEXT | Descrição da pauta |
| `aprovacao` | BOOLEAN | TRUE=aprovado, NULL=inconclusivo |
| `ingested_at` | TIMESTAMPTZ | Timestamp de carga |

#### `fato_despesas`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `cod_documento` | TEXT PK (composta) | Código do documento CEAP |
| `parcela` | INTEGER PK (composta) | Parcela do pagamento |
| `deputado_id` | INTEGER FK | → `dim_deputados` |
| `ano` / `mes` | SMALLINT | Período da despesa |
| `tipo_despesa` | TEXT | Categoria CEAP |
| `valor_documento` | NUMERIC(12,2) | Valor bruto |
| `valor_liquido` | NUMERIC(12,2) | Valor após glosa (canônico para análises) |
| `valor_glosa` | NUMERIC(12,2) | Valor recusado |
| `fornecedor_nome` | TEXT | Razão social |
| `fornecedor_cnpj` | TEXT | CNPJ/CPF normalizado |
| `ingested_at` | TIMESTAMPTZ | Timestamp de carga |

#### `ponte_proposicao_autores` (N:N — Pós V1)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `proposicao_id` | INTEGER | → `fato_proposicoes` |
| `autor_tipo` | TEXT | String crua da API (ex: `Deputado(a)`, `COMISSÃO PERMANENTE`) |
| `deputado_id` | INTEGER | preenchido quando a URI é `/deputados/{id}` (sem FK rígida) |
| `partido_id` | INTEGER | preenchido quando a URI é `/partidos/{id}` |
| `nome_autor` | TEXT | Nome do autor |
| `ordem_assinatura` / `proponente` | INTEGER / BOOLEAN | Ordem e se é o proponente |
| `uri_autor` | TEXT | URI da API (fonte da verdade do tipo) |

> Índice único: `(proposicao_id, autor_tipo, nome_autor, COALESCE(uri_autor,''))`.
> Sem FK para as dims — autores podem ser de legislaturas passadas, comissões, Senado ou Executivo.

#### `fato_votacao_votos` (Pós V1)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `votacao_id` | TEXT | → `fato_votacoes` |
| `deputado_id` | INTEGER | → `dim_deputados` |
| `tipo_voto` | TEXT | Sim / Não / Abstenção / Obstrução... |
| `sigla_partido_voto` | TEXT | Partido **no momento do voto** (pode diferir do atual) |
| `sigla_uf_voto` | TEXT | UF no momento do voto |

> Chave: `(votacao_id, deputado_id)`. Votações simbólicas retornam lista vazia (normal).

---

## 4. Stack Tecnológica

| Camada | Tecnologia | Versão | Justificativa |
|--------|-----------|--------|---------------|
| Linguagem | Python | 3.14 | Padrão em engenharia de dados |
| HTTP + Retry | `requests` + `tenacity` | 2.32 / 9.0 | Retry exponencial com decorators limpos |
| Transformação | `pandas` | ≥ 3.0.3 | ETL de pequeno/médio porte |
| ORM + Driver | `SQLAlchemy` + `psycopg2-binary` | 2.0 / 2.9 | Abstração madura + driver oficial |
| Banco | PostgreSQL — Supabase | 15+ | Gerenciado, pgvector incluso, free tier |
| Vetores | `pgvector` | 0.7 | Vector store direto no Postgres |
| IA — Embeddings | `text-embedding-3-small` | — | ~US$ 0.02/1M tokens |
| IA — Resumo | `gpt-4o-mini` | — | Melhor custo para PT-BR |
| Dashboard | Next.js + React + Recharts + SWR | 16 | Painel ao vivo lendo o Supabase (anon) |
| Orquestração | n8n Cloud | — | E-mail semanal via SMTP, query direta no Postgres |
| Ambiente | `python-dotenv` | 1.0 | Leitura de `.env` |

---

## 5. Pré-Requisitos

Antes de começar, certifique-se de ter:

- [ ] **Python 3.11+** instalado (testado em 3.14)
- [ ] **Git** instalado
- [ ] **Conta no Supabase** (free tier é suficiente) — [supabase.com](https://supabase.com)
- [ ] **Chave da OpenAI** com billing ativo — apenas para Sprint 3 (enriquecimento IA)
- [ ] **Conta no n8n Cloud** (free tier) — apenas para automação — [n8n.io](https://n8n.io)

---

## 6. Setup Completo — Passo a Passo

### Passo 1 — Clonar o repositório

```bash
git clone https://github.com/<seu-usuario>/bussola-publica.git
cd bussola-publica
```

### Passo 2 — Criar e ativar o ambiente virtual

```bash
# Criar o venv
python -m venv .venv

# Ativar (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Ativar (Windows CMD)
.venv\Scripts\activate.bat

# Ativar (Linux / macOS)
source .venv/bin/activate
```

> O prompt do terminal deve mostrar `(.venv)` indicando que o ambiente está ativo.

### Passo 3 — Instalar dependências

```bash
# --only-binary evita compilação de source (necessário no Windows com Python 3.14+)
pip install --only-binary :all: -r requirements.txt
```

> **Atenção Windows:** Se o caminho de instalação contiver caracteres especiais (acentos, espaços), sempre use `--only-binary :all:`. Caso algum pacote específico falhe, instale-o individualmente com a mesma flag.

Verifique a instalação:

```bash
python -c "import pandas, sqlalchemy, openai; print('OK')"
```

### Passo 4 — Configurar variáveis de ambiente

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Abra o arquivo `.env` e preencha os valores:

```dotenv
# OBRIGATÓRIO para Sprint 2+
DATABASE_URL=postgresql://postgres:<sua-senha>@db.<projeto>.supabase.co:5432/postgres

# OBRIGATÓRIO para Sprint 3 (IA)
OPENAI_API_KEY=sk-...

# Opcionais (valores default já configurados)
CAMARA_API_BASE_URL=https://dadosabertos.camara.leg.br/api/v2
CAMARA_API_TIMEOUT_SECONDS=30
CAMARA_API_PAGE_SIZE=100
DATA_RAW_DIR=./data/raw
LOG_LEVEL=INFO
```

> **O arquivo `.env` nunca vai para o Git** — já está no `.gitignore`.

### Passo 5 — Provisionar o banco de dados (Supabase)

#### 5.1 Criar o projeto no Supabase

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard) e crie um novo projeto
2. Anote a **Connection String** em `Settings > Database > Connection string > URI`
3. Cole essa URL como `DATABASE_URL` no seu `.env`

#### 5.2 Habilitar pgvector

No **SQL Editor** do Supabase, execute:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 5.3 Criar o schema dimensional

No **SQL Editor**, copie e cole o conteúdo completo de `sql/schema.sql` e execute.

Resultado esperado: 5 tabelas criadas (`dim_partidos`, `dim_deputados`, `dim_temas`, `fato_proposicoes`, `fato_votacoes`, `fato_despesas`).

#### 5.4 Popular os temas iniciais

No **SQL Editor**, copie e cole o conteúdo de `sql/seeds_temas.sql` e execute.

Resultado esperado: 10 linhas inseridas em `dim_temas`.

Verificação rápida:

```sql
SELECT tema_id, nome, critico FROM dim_temas ORDER BY tema_id;
```

### Passo 6 — Validar a conexão

```bash
python scripts/explore_api.py
```

Este script valida:
- Conectividade com a API da Câmara
- Exibe amostra de deputados, partidos e proposições

Se não houver erro, o ambiente está pronto.

---

## 7. Como Executar

### Pipeline Completo (zero a banco populado)

Execute nesta ordem na primeira vez:

```bash
# 1. Extrair dados brutos da API para data/raw/
python scripts/1_run_extraction.py

# 2. Transformar + carregar no banco
python scripts/2_run_pipeline.py --apenas-carga
```

Ou em comando único (extrai + transforma + carrega):

```bash
python scripts/2_run_pipeline.py
```

---

### Modos de Execução

#### Incremental diário (uso em produção)

Extrai apenas registros das últimas 24h:

```bash
python scripts/2_run_pipeline.py --incremental
```

#### Apenas carga (pular extração)

Usa os JSONs já salvos em `data/raw/`:

```bash
python scripts/2_run_pipeline.py --apenas-carga
```

#### Despesas CEAP (~20 minutos, ~500 chamadas HTTP + ~145k linhas)

Pipeline isolado, fora do escopo do Radar Legislativo. Extrai **e** carrega num
único comando. Rode por **último**, depois dos demais, para não travar o ciclo:

```bash
# Extrai + transforma + carrega despesas de 2025 (idempotente)
python scripts/6_run_despesas.py --ano 2025

# Variacoes: so extrair, ou so carregar o raw ja existente
python scripts/6_run_despesas.py --ano 2025 --apenas-extracao
python scripts/6_run_despesas.py --apenas-carga
```

#### Enriquecimento com IA (Sprint 3)

> Requer `OPENAI_API_KEY` configurada com billing ativo.

```bash
# Processar até 100 proposições (embedding + classificação + resumo)
python scripts/3_run_ai_enrichment.py --limite 100

# Apenas embeddings (sem resumo — mais barato)
python scripts/3_run_ai_enrichment.py --apenas-embed

# Apenas resumos (proposições já com embedding)
python scripts/3_run_ai_enrichment.py --apenas-resume

# Teste piloto com 10 registros (recomendado antes de qualquer escala)
python scripts/3_run_ai_enrichment.py --limite 10
```

#### Autoria (ponte N:N) + votos nominais (roadmap pós V1)

> Requer a migration `sql/migration_autoria_votos.sql` aplicada no Supabase.
> Destrava o heatmap **tema × partido**, autoria por deputado/partido e voto nominal.

```bash
# Popular a ponte proposição<->autor (1 chamada /proposicoes/{id}/autores por proposição)
python scripts/4_run_authors_bridge.py --only-missing

# Vincular votação->proposição e popular os votos nominais
python scripts/5_run_votes_bridge.py --only-missing

# Tudo de uma vez, integrado ao pipeline:
python scripts/2_run_pipeline.py --with-authors --with-votes
```

#### Exploração interativa da API

```bash
python scripts/explore_api.py
```

---

### Ordem recomendada para carga completa do zero

```
1. python scripts/explore_api.py                       # valida conectividade
2. python scripts/1_run_extraction.py                  # extrai raw data (~5 min)
3. python scripts/2_run_pipeline.py --apenas-carga     # transforma + carrega (~2 min)
4. python scripts/3_run_ai_enrichment.py --limite 10   # teste piloto IA
5. python scripts/3_run_ai_enrichment.py --limite 100  # enriquecimento em escala
6. python scripts/4_run_authors_bridge.py --only-missing  # ponte proposicao<->autor (pos V1)
7. python scripts/5_run_votes_bridge.py --only-missing    # votos nominais + vinculo (pos V1)
8. python scripts/6_run_despesas.py --ano 2025            # despesas CEAP, por ultimo (lento, ~20min)
```

---

### Verificar dados carregados

Conecte-se ao banco via SQL Editor do Supabase ou qualquer cliente PostgreSQL:

```sql
-- Contagem por tabela
SELECT 'dim_partidos'   AS tabela, COUNT(*) AS registros FROM dim_partidos
UNION ALL
SELECT 'dim_deputados',  COUNT(*) FROM dim_deputados
UNION ALL
SELECT 'fato_proposicoes', COUNT(*) FROM fato_proposicoes
UNION ALL
SELECT 'fato_votacoes',  COUNT(*) FROM fato_votacoes
UNION ALL
SELECT 'fato_despesas',  COUNT(*) FROM fato_despesas;

-- Proposições enriquecidas pela IA
SELECT
    COUNT(*)                                          AS total,
    COUNT(embedding)                                  AS com_embedding,
    COUNT(tema_id)                                    AS classificadas,
    COUNT(resumo_executivo)                           AS com_resumo
FROM fato_proposicoes;

-- Top 5 temas mais frequentes
SELECT t.nome, COUNT(*) AS proposicoes
FROM fato_proposicoes p
JOIN dim_temas t ON p.tema_id = t.tema_id
GROUP BY t.nome
ORDER BY proposicoes DESC
LIMIT 5;
```

---

## 8. Camada de IA

### Arquitetura

```
proposicao.ementa
       │
       ▼
[embedder.py] ──► text-embedding-3-small ──► VECTOR(1536)
       │                                           │
       │                              fato_proposicoes.embedding
       ▼
[classifier.py] ──► cosseno vs dim_temas ──► tema_id (se score ≥ 0.30)
       │
       ▼
[summarizer.py] ──► gpt-4o-mini (T=0.2) ──► resumo_executivo (3 linhas)
```

### Módulos

| Módulo | Função | Custo estimado |
|--------|--------|----------------|
| `src/ai/embedder.py` | Gera vetores 1536D das ementas | US$ 0.02 / 1M tokens |
| `src/ai/classifier.py` | Classifica tema por similaridade de cosseno | Incluso no embedder |
| `src/ai/summarizer.py` | Gera resumo executivo de 3 linhas | US$ 0.15/1M in + US$ 0.60/1M out |

### Idempotência

Cada módulo verifica se o campo já está preenchido **antes** de chamar a API. Re-execuções não geram custo adicional para registros já processados.

### Controle de custo

- **Hard cap:** US$ 10/mês configurado na dashboard da OpenAI (`Settings → Limits`)
- **Log automático:** cada execução grava em `docs/custo_ia.csv`
- **Threshold de classificação:** `0.30` — proposições abaixo não recebem tema (evita falsos positivos)

Decisões de arquitetura detalhadas em [docs/decisoes_ia.md](docs/decisoes_ia.md).

---

## 9. Entrega: Dashboard + Automação n8n

### Dashboard — Bússola Legislativa (Next.js 16)

Painel web que lê o Supabase **ao vivo** (via views agregadas e a chave anon),
com auto-refresh a cada 60s. Pasta `dashboard/`.

| Seção | Mostra |
|-------|--------|
| Visão Geral | KPIs (deputados, proposições, votações, despesas, cobertura de IA) |
| Radar Temático | Distribuição por tema + **heatmap tema × partido** (autoria) |
| Atividade Parlamentar | Proposições por partido (autor), top deputados por autoria, bancadas, CEAP |
| Votações | Resultado das votações + **"como cada partido votou"** (votos nominais) |
| IA Legislativa | Cobertura de embeddings/tema/resumo, exemplos de resumo executivo |
| Alertas | Temas críticos e proposições recentes classificadas |
| Arquitetura · Sobre · Equipe | Modelo de 8 tabelas, stack e integrantes |

```bash
cd dashboard
npm install
# .env.local: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev          # http://localhost:3000
npm run build        # gera out/ (site 100% estatico, pronto p/ publicar)
```

> **Publicar para a banca/turma:** o build é estático (`out/`) e o próprio site serve o
> dashboard ao vivo, as **apresentações** (`/apresentacao/`) e o **workflow n8n**
> (`/n8n/`). Passo a passo (Vercel, Netlify, GitHub Pages) em
> [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md).

> Os painéis de **autoria** e **votos por partido** dependem dos bridges (scripts 4 e 5)
> e das views da migration `sql/migration_autoria_votos.sql`.

### Automação n8n — E-mail semanal (Top 5 da semana)

```
[Cron Segunda 08:00 BRT]   (0 8 * * 1)
            │
            ▼
[SQL: Top 5 proposições da semana — últimos 7 dias]
       (ORDER BY critico DESC, qtd_autores DESC, data DESC)
            │
            ▼
[Code: monta e-mail HTML — sem proposições → não envia]
            │
            ▼
[SMTP: envia para os e-mails da equipe (teste)]
```

### Configurar o workflow

1. Importe `n8n/bussola_email_semanal.json` no painel do n8n
2. Configure as credenciais:
   - **PostgreSQL:** connection string do Supabase
   - **SMTP:** ex. Gmail (`smtp.gmail.com:465`, SSL) com App Password
3. Ajuste o `fromEmail` no nó "Envia email para a equipe"
4. Ative o workflow (ou use "Test workflow" para enviar na hora)

> A ingestão (scripts 1–6) **não** é mais orquestrada pelo n8n nesta versão —
> rode-a manualmente para manter os dados frescos antes do envio semanal.

### E-mail semanal — Top 5 da semana

As 5 proposições mais relevantes dos últimos 7 dias (tema crítico primeiro,
depois maior nº de autores). Enviado aos integrantes como teste:

```
[Bússola Pública] Top 5 da semana — DD/MM/YYYY

🔴 Crítico · Tributário · 3 autor(es) · Dep. Fulano
PL 1234/2025
Altera a incidência do imposto de renda sobre dividendos.
Resumo: A proposição modifica as alíquotas do IR sobre lucros distribuídos...
---
[até 5 proposições]
```

### Apresentação executiva (slides HTML)

Dois decks HTML autocontidos (navegação por teclado/scroll/setas, sem dependências externas):

| Deck | Conteúdo | Arquivo |
|------|----------|---------|
| **p1 · Arquitetura** | Pipeline ETL, modelo estrela, camada de IA, stack e entrega | [`presentation/p1-arquitetura.html`](presentation/p1-arquitetura.html) |
| **p2 · Resultados** | Dataset, gastos CEAP, proposições, votações e o dashboard ao vivo | [`presentation/p2-resultados.html`](presentation/p2-resultados.html) |

Abra cada arquivo direto no navegador (duplo clique). O **dashboard hospedado** também
serve as duas apresentações — aba **Entregáveis → "Apresentação executiva"**: abra em
nova guia ou baixe o `.html`. Os prints exibidos nos slides vêm de
[`docs/prints/`](docs/prints/) (e são espelhados em `dashboard/public/` para o site estático).

---

## 10. Estrutura de Pastas

```
bussola-publica/
│
├── CLAUDE.md                        # Instruções para o Claude Code
├── README.md                        # Este arquivo
├── .env.example                     # Template de variáveis (copiar para .env)
├── .env                             # Seus segredos (NUNCA commitar)
├── .gitignore
├── requirements.txt
│
├── specs/                           # Especificações formais (SDD)
│   ├── README.md                    # Guia do SDD workflow
│   ├── data-model.md                # Schema estrela completo
│   ├── extract.md                   # Regras de extração da API
│   ├── transform.md                 # Regras de transformação e carga
│   ├── ai-enrichment.md             # Pipeline IA: embedding, classificação, resumo
│   └── orchestration.md             # Workflow n8n
│
├── src/
│   ├── config.py                    # Config central + fail-fast
│   ├── extract/
│   │   └── camara_api.py            # CamaraAPIClient: fetch_* com retry e paginação
│   ├── transform/
│   │   ├── partidos.py              # raw → dim_partidos
│   │   ├── deputados.py             # raw → dim_deputados
│   │   ├── proposicoes.py           # raw → fato_proposicoes
│   │   ├── votacoes.py              # raw → fato_votacoes
│   │   ├── despesas.py              # raw → fato_despesas (CEAP)
│   │   ├── autores.py              # payload autores → ponte (resolve tipo pela URI)
│   │   └── votos.py                # payload votos → registros de voto nominal
│   ├── load/
│   │   └── upsert.py                # Upsert idempotente (inclui ponte/votos/flags/erros)
│   ├── bridge/                      # Pós V1: orquestração dos bridges
│   │   ├── autores.py              # run_authors_bridge (ponte N:N)
│   │   └── votos.py                # run_votes_bridge (votos + vínculo votação→prop)
│   ├── utils/
│   │   └── text.py                  # safe_str, clean_text, normalize_cnpj_cpf
│   └── ai/
│       ├── embedder.py              # Gera embeddings via text-embedding-3-small
│       ├── classifier.py            # Classificação temática por cosseno
│       ├── summarizer.py            # Resumo executivo via gpt-4o-mini
│       └── prompts/
│           └── resumo_executivo.md  # Prompt versionado para gpt-4o-mini
│
├── scripts/                         # numerados na ordem de execução
│   ├── explore_api.py               # Sprint 1: exploração interativa da API
│   ├── 1_run_extraction.py          # Sprint 2: extração (raw → data/raw/)
│   ├── 2_run_pipeline.py            # Sprint 2+3: pipeline E2E (+ --with-authors/--with-votes)
│   ├── 3_run_ai_enrichment.py       # Sprint 3: enriquecimento IA
│   ├── 4_run_authors_bridge.py      # Pós V1: ponte proposição<->autor
│   ├── 5_run_votes_bridge.py        # Pós V1: votos nominais + vínculo votação->proposição
│   ├── 6_run_despesas.py            # Despesas CEAP: pipeline isolado (rodar por último)
│   └── trigger_server.py            # servidor HTTP p/ acionar via n8n
│
├── sql/
│   ├── schema.sql                      # DDL do modelo dimensional (rodar 1x no Supabase)
│   ├── migration_autoria_votos.sql     # Pós V1: ponte N:N, votos nominais, views agregadas
│   └── seeds_temas.sql                 # 10 temas iniciais para dim_temas
│
├── data/
│   ├── raw/                         # JSONs brutos da API (git-ignored)
│   │   ├── deputados/
│   │   ├── partidos/
│   │   ├── proposicoes/
│   │   ├── votacoes/
│   │   └── deputados_despesas/
│   └── processed/
│       └── _quarentena/             # Registros inválidos aguardando revisão
│
├── notebooks/
│   └── 01_exploracao_api.ipynb      # Exploração interativa do Sprint 1
│
├── dashboard/                       # Painel Next.js 16 (Bússola Legislativa)
│   ├── app/                         # App Router + globals.css (tema/cores-raiz)
│   ├── components/sections/         # Visão Geral, Radar Temático, Votações, ...
│   └── lib/                         # queries.ts (views), types.ts, equipe.ts
│
├── presentation/                    # Apresentações HTML (p1-arquitetura, p2-resultados)
│
├── n8n/
│   └── bussola_email_semanal.json   # Workflow n8n: e-mail semanal Top 5 (importar no painel)
│
└── docs/
    ├── PRD.md                       # Product Requirements Document completo
    ├── AGENT_INGESTOR.md            # System prompt para copiloto da camada Extract
    ├── AGENT_TRANSFORM.md           # System prompt para copiloto da camada Transform
    ├── decisoes_ia.md               # ADR: decisões de arquitetura de IA
    ├── custo_ia.csv                 # Log de custos OpenAI (gerado automaticamente)
    └── prints/                      # Screenshots de execução e demonstração
```

---

## 11. Variáveis de Ambiente

| Variável | Obrigatória | Default | Descrição |
|----------|:-----------:|---------|-----------|
| `DATABASE_URL` | ✅ Sprint 2+ | — | PostgreSQL connection string do Supabase |
| `OPENAI_API_KEY` | ✅ Sprint 3 | — | Chave da OpenAI (com billing ativo) |
| `CAMARA_API_BASE_URL` | — | `https://dadosabertos.camara.leg.br/api/v2` | URL base da API |
| `CAMARA_API_TIMEOUT_SECONDS` | — | `30` | Timeout HTTP em segundos |
| `CAMARA_API_PAGE_SIZE` | — | `100` | Itens por página (máximo da API) |
| `DATA_RAW_DIR` | — | `./data/raw` | Diretório para JSONs brutos |
| `LOG_LEVEL` | — | `INFO` | DEBUG / INFO / WARNING / ERROR |

---

## 12. Troubleshooting

| Erro | Causa provável | Solução |
|------|---------------|---------|
| `RuntimeError: DATABASE_URL nao configurada` | `.env` não criado ou incompleto | `copy .env.example .env` e preencher `DATABASE_URL` |
| `ModuleNotFoundError: No module named 'pandas'` | Dependências não instaladas | `pip install --only-binary :all: -r requirements.txt` |
| `UnicodeDecodeError` durante pip install | Caminho com acentos no Windows | Usar sempre `--only-binary :all:` em todo `pip install` |
| `FileNotFoundError: data/raw/...` | Dados não extraídos | Executar `python scripts/1_run_extraction.py` primeiro |
| `relation "dim_partidos" does not exist` | Schema não aplicado | Executar `sql/schema.sql` no SQL Editor do Supabase |
| `openai.RateLimitError: insufficient_quota` | Sem crédito na conta OpenAI | Adicionar billing em [platform.openai.com/settings](https://platform.openai.com/settings) |
| Pipeline duplica registros | Execução sem upsert | Todos os upserts usam `ON CONFLICT DO UPDATE` — verifique se não há INSERT direto |
| `psycopg2.OperationalError: SSL connection` | Supabase exige SSL | A string de conexão do Supabase já inclui SSL por padrão; não modificar |
| `HTTP 400 "instance":"pagina, itens"` no bridge | Sub-recurso (autores/votos) chamado com paginação | Esses endpoints usam `save_one` (sem `itens`/`pagina`), não `save_raw` |
| Painel de autoria/heatmap vazio | Ponte não populada ou `deputado_id` nulo | Rodar `4_run_authors_bridge.py`; o tipo do autor é resolvido pela **URI**, não pela string `tipo` |
| Pipeline diário lento | Despesas no ciclo principal | Despesas têm pipeline próprio (`6_run_despesas.py`); `upsert_all` as pula por padrão |

### Diagnóstico rápido

```bash
# Verificar variáveis carregadas
python -c "from src.config import settings; print(settings)"

# Contar registros por tabela
python -c "
from sqlalchemy import create_engine, text
import os; from dotenv import load_dotenv
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    for t in ['dim_partidos','dim_deputados','fato_proposicoes','fato_votacoes','ponte_proposicao_autores','fato_votacao_votos','fato_despesas']:
        r = conn.execute(text(f'SELECT COUNT(*) FROM {t}')).scalar()
        print(f'{t}: {r}')
"
```

---

## 13. Segurança

- **Segredos:** exclusivamente via `.env` — nunca em código ou commits
- **`.env` no `.gitignore`:** garantido desde o primeiro commit
- **`.env.example`:** documenta variáveis sem valores reais
- **Hard cap OpenAI:** US$ 10/mês configurado na dashboard (`Settings → Limits`)
- **Supabase:** writes via `service_role` apenas localmente; `anon key` para leitura pública em apresentações
- **Dados públicos:** todos os dados provêm da API pública da Câmara dos Deputados (Lei de Acesso à Informação — LAI); nenhum dado pessoal sensível é processado

> **Antes do primeiro push:** verifique com `git status` que `.env` **não** aparece como arquivo rastreado.

---

## 14. Status dos Sprints

| Sprint | Escopo | Status |
|--------|--------|:------:|
| **Sprint 1** | Exploração da API, cliente HTTP com retry e paginação automática | ✅ Concluído |
| **Sprint 2** | Transformação Pandas, carga upsert idempotente, despesas CEAP (~145k registros) | ✅ Concluído |
| **Sprint 3** | IA: embeddings pgvector, classificação temática por cosseno, resumo executivo GPT-4o-mini | ✅ Concluído |
| **Pós V1** | Autoria N:N (ponte), votos nominais, heatmap tema × partido | ✅ Concluído |
| **Entrega** | Dashboard Next.js ao vivo + workflow n8n de e-mail semanal | ✅ Concluído |

**Janela de entrega:** 13/Mai/2026 → 15/Jun/2026

### Roadmap (próximos passos)

| Item | Valor esperado |
|------|---------------|
| Completar a autoria das 1.550 proposições (rodar o bridge em lotes) | Cobertura total do heatmap |
| Análise de coerência partidária sobre `fato_votacao_votos` | Score de fidelidade por deputado |
| RAG sobre histórico legislativo (LLM + pgvector) | Q&A: "O que foi votado sobre IA nos últimos 12 meses?" |
| API REST pública para jornalistas/pesquisadores | Dados estruturados + IA via REST |
| Índices HNSW em pgvector para busca semântica | Performance em escala |
| CI/CD com GitHub Actions | Maturidade de engenharia |

---

## Referências

- [API Câmara dos Deputados — Documentação Swagger](https://dadosabertos.camara.leg.br/swagger/api.html)
- [Supabase Docs](https://supabase.com/docs)
- [pgvector — Repositório oficial](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [n8n Documentation](https://docs.n8n.io)

---

*Pós-Tech Engenharia de Dados Xperiun — Projeto Integrador 2026*
