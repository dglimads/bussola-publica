# Spec: Enriquecimento por IA — Bussola Publica

**Status:** active
**Versao:** 1.0
**Ultima atualizacao:** 2026-05-17
**Implementacao:** `src/ai/`, `scripts/run_ai_enrichment.py`
**ADR completo:** `docs/decisoes_ia.md`

---

## Contexto

Camada de enriquecimento semantico das proposicoes legislativas usando
a API da OpenAI. Tres operacoes distintas e idempotentes:
1. **Embedding** — vetor semantico da ementa (pgvector)
2. **Classificacao tematica** — tema mais proximo por similaridade de cosseno
3. **Resumo executivo** — resumo de 3 linhas gerado por LLM

**Premissa de custo:** custo negligivel para o volume do projeto (<US$10/mes).

---

## Arquitetura

```
proposicao (ementa)
      |
      v
[embedder.py] ──► text-embedding-3-small ──► VECTOR(1536)
      |                                            |
      |                                   fato_proposicoes.embedding
      v
[classifier.py] ──► cosseno vs dim_temas ──► tema_id (se score >= 0.30)
      |
      v
[summarizer.py] ──► gpt-4o-mini (T=0.2) ──► resumo_executivo (3 linhas)
```

---

## Modulos e Responsabilidades

### `src/ai/embedder.py` — `embed_pending()`

- Busca proposicoes com `embedding IS NULL` e `ementa != ''`
- Gera embedding via `text-embedding-3-small`
- Persiste `VECTOR(1536)` em `fato_proposicoes.embedding`
- Deve rodar ANTES de `classify_pending()`

### `src/ai/classifier.py` — `classify_pending()`

- Busca proposicoes com `embedding IS NOT NULL` e `tema_id IS NULL`
- Gera embeddings dos 10 temas de `dim_temas` (nome + descricao)
- Calcula similaridade de cosseno: proposicao vs cada tema
- Atribui `tema_id` do tema com maior score SE score >= `THRESHOLD` (0.30)
- Proposicoes abaixo do threshold ficam com `tema_id = NULL`
- Deve rodar APOS `embed_pending()`

### `src/ai/summarizer.py` — `summarize_pending()`

- Busca proposicoes com `resumo_executivo IS NULL` e `ementa != ''`
- Gera resumo de 3 linhas via `gpt-4o-mini` com prompt versionado
- Persiste em `fato_proposicoes.resumo_executivo`
- Independente de `embed_pending()` e `classify_pending()`

---

## Parametros dos Modelos

| Parametro | Valor | Motivo |
|-----------|-------|--------|
| Embedding model | `text-embedding-3-small` | Menor custo, qualidade suficiente para 10 temas |
| Embedding dim | `1536` | Fixo pelo modelo — nao alterar sem migrar o banco |
| Chat model | `gpt-4o-mini` | Custo/qualidade ideal para resumos de 3 linhas |
| Temperatura | `0.2` | Favorece consistencia — resumos legislativos precisam de fatos |
| max_tokens | `200` | Suficiente para 3 linhas executivas |
| Threshold cosseno | `0.30` | Calibrado empiricamente; ajustavel em `classifier.py::THRESHOLD` |

---

## Prompt Versionado

Arquivo: `src/ai/prompts/resumo_executivo.md`

Instrucoes ao modelo:
- Persona: analista senior de Relacoes Governamentais
- Linguagem executiva — nao juridica
- Nao opinar, nao inventar, nao extrapolar
- Formato: exatamente 3 linhas curtas
- Sem markdown, sem bullets

---

## Idempotencia

Cada modulo verifica se o campo ja esta preenchido ANTES de chamar a API:
- `embed_pending()`: filtra `WHERE embedding IS NULL`
- `classify_pending()`: filtra `WHERE embedding IS NOT NULL AND tema_id IS NULL`
- `summarize_pending()`: filtra `WHERE resumo_executivo IS NULL`

**Re-execucao nao gera custo adicional** para registros ja processados.

O upsert em `fato_proposicoes` usa COALESCE para preservar campos existentes:
```sql
tema_id = COALESCE(fato_proposicoes.tema_id, EXCLUDED.tema_id)
```

---

## Tratamento de Erros

| Situacao | Tratamento |
|----------|------------|
| Ementa vazia ou < 20 chars | Pulada (filtro `WHERE ementa != ''`) |
| Score de cosseno < 0.30 | `tema_id = NULL` — sem classificacao forcada |
| Timeout / rate limit (429) | Break do loop; persiste o que foi processado |
| Quota excedida (429) | Log de aviso com instrucao de acao |
| Erro de conexao | Retry com backoff antes de abortar |

---

## Controle de Custos

| Operacao | Modelo | Custo/1M tokens |
|----------|--------|----------------|
| Embedding | text-embedding-3-small | US$ 0.02 |
| Resumo | gpt-4o-mini | US$ 0.15 (input) / US$ 0.60 (output) |

**Estimativas por volume:**

| Cenario | Proposicoes/dia | Custo/dia | Custo/mes |
|---------|----------------|-----------|-----------|
| Conservador | 20 | US$ 0.003 | ~US$ 0.06 |
| Normal | 100 | US$ 0.015 | ~US$ 0.33 |
| Intensivo | 500 | US$ 0.075 | ~US$ 1.65 |

Hard cap configurado em `platform.openai.com` → Settings → Limits: **US$ 10/mes**

Log de execucao: `docs/custo_ia.csv`

```
data,operacao,tokens,custo_usd,modelo
2026-05-17,embed_pending,6000,0.000120,text-embedding-3-small
2026-05-17,summarize_pending,28000,0.012600,gpt-4o-mini
```

---

## Requisitos

- **R1:** Idempotencia — verificar campo antes de chamar a API
- **R2:** Ordem de execucao: `embed_pending()` → `classify_pending()` → `summarize_pending()`
- **R3:** Threshold 0.30 configuraval em constante (nao hardcoded em logica)
- **R4:** Campos IA atualizados via COALESCE no upsert
- **R5:** Log de custo por operacao em `docs/custo_ia.csv`
- **R6:** `--limite N` funcional para testar sem processar todo o dataset
- **R7:** `OPENAI_API_KEY` obrigatoria — falha cedo se ausente
- **R8:** Hard cap configurado externamente (dashboard OpenAI) — nao via codigo

---

## Restricoes

- `OPENAI_HARD_CAP_USD = 10.0` — configurar na dashboard da OpenAI
- Nao usar `gpt-4o` para classificacao (custo ~50x maior sem ganho proporcional)
- Nao usar fine-tuning ou NLI local — complexidade desproporcional para V1
- Nao alterar dimensao do embedding sem migrar `fato_proposicoes.embedding`

---

## Variavel de Ambiente

| Variavel | Obrigatoria | Default | Descricao |
|----------|-------------|---------|-----------|
| `OPENAI_API_KEY` | Sprint 3 | — | Chave da API OpenAI |
| `OPENAI_EMBEDDING_MODEL` | Nao | `text-embedding-3-small` | |
| `OPENAI_CHAT_MODEL` | Nao | `gpt-4o-mini` | |
| `OPENAI_HARD_CAP_USD` | Nao | `10.0` | Referencia para alertas de custo |

---

## Metricas de Qualidade

| Metrica | Meta | Como validar |
|---------|------|-------------|
| Acuracia de classificacao | >= 80% | Sample manual de 50 proposicoes |
| Proposicoes com embedding | >= 80% do total | `SELECT count(*) WHERE embedding IS NOT NULL` |
| Proposicoes com tema_id | >= 70% do total | `SELECT count(*) WHERE tema_id IS NOT NULL` |
| Proposicoes com resumo | >= 80% do total | `SELECT count(*) WHERE resumo_executivo IS NOT NULL` |

---

## Open Questions

- [ ] Votos individuais: gerar perfil de votacao por deputado (Sprint 3+)
- [ ] Resolucao de `proposicao_id` em `fato_votacoes` via fuzzy match (Sprint 3+)
- [ ] Indices pgvector (HNSW) para busca semantica em producao (Sprint 3+)

---

## Changelog

- 1.0 (2026-05-17): Versao inicial — distillada de decisoes_ia.md; Sprint 3 implementado, aguardando credito OpenAI
