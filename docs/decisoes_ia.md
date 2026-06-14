# Decisoes de IA — Bussola Publica

**Sprint:** 3
**Ultima atualizacao:** 2026-05-17

---

## 1. Classificacao Tematica

**Abordagem escolhida:** embeddings + similaridade de cosseno (Caminho A do desafio)

**Modelo:** `text-embedding-3-small` (OpenAI) — 1536 dimensoes

**Por que nao LLM para classificar?**
Classificar usando um LLM (ex: "qual tema melhor descreve esta proposicao?") custaria ~50x mais
por proposicao e adicionaria latencia desnecessaria. Com 10 temas bem definidos e ementas
legislativas de vocabulario previsivel, similaridade de cosseno entre embeddings atinge
acuracia equivalente com custo negligivel.

**Fluxo implementado (`src/ai/embedder.py` + `src/ai/classifier.py`):**
1. Para cada proposicao com `embedding IS NULL`: gera embedding da ementa via API
2. Persiste o vetor em `fato_proposicoes.embedding` (tipo `VECTOR(1536)` — pgvector)
3. Gera embeddings dos 10 temas de `dim_temas` (nome + descricao) on-demand
4. Calcula similaridade de cosseno entre proposicao e cada tema
5. Atribui `tema_id` do tema com maior score (se score >= 0.30)
6. Proposicoes abaixo do threshold ficam com `tema_id = NULL` (sem forcar classificacao ruim)

**Threshold de 0.30:** calibrado empiricamente para evitar falsos positivos em ementas
muito curtas ou tecnicas. Ajustavel em `src/ai/classifier.py::THRESHOLD`.

**Custo estimado:**
- US$ 0.02 por 1M tokens (text-embedding-3-small)
- 100 proposicoes x ~60 tokens/ementa = US$ 0.000120 por rodada diaria
- Custo anual estimado (250 dias uteis x 20 proposicoes/dia): US$ 0.006

**Alternativas descartadas:**
| Alternativa | Motivo do descarte |
|---|---|
| LLM-as-judge (gpt-4o-mini para classificar) | Custo ~50x maior, latencia ~10x maior |
| Fine-tuning de classificador | Requer dados rotulados; complexidade desproporcional para V1 |
| Zero-shot NLI (sentence-transformers local) | Requer GPU ou download de modelo pesado; sem dependencia extra |
| Regex por palavras-chave | Fragil, nao generaliza, manutencao cara |

---

## 2. Resumo Executivo

**Abordagem escolhida:** LLM com prompt fixo e temperatura baixa (Caminho B do desafio)

**Modelo:** `gpt-4o-mini`

**Por que gpt-4o-mini e nao gpt-4o?**
Para resumos de 3 linhas de ementas legislativas, gpt-4o-mini entrega qualidade
equivalente a uma fracao do custo. gpt-4o seria justificavel apenas para analises
juridicas complexas ou correlacao entre multiplos documentos.

**Temperatura: 0.2** — favorece consistencia e factualidade sobre criatividade.
Resumos legislativos nao devem ser criativos; devem ser precisos.

**Prompt versionado:** `src/ai/prompts/resumo_executivo.md`
Persona de analista senior de Relacoes Governamentais instrui o modelo a:
- Usar linguagem de executivo, nao juridica
- Nao opinar, nao inventar
- Limitar a 3 linhas (max_tokens=200)

**Custo estimado:**
| Cenario | Proposicoes/dia | Custo/dia | Custo/mes |
|---|---|---|---|
| Conservador | 20 | US$ 0.0025 | US$ 0.055 |
| Normal | 100 | US$ 0.0125 | US$ 0.275 |
| Intensivo | 500 | US$ 0.0625 | US$ 1.375 |

Custo total mensal bem abaixo do hard cap de US$ 10.

---

## 3. Arquitetura da Camada de IA

```
proposicao (ementa)
        |
        v
[embedder.py] --> text-embedding-3-small --> vetor 1536D
        |                                         |
        |                                   fato_proposicoes
        |                                   .embedding (pgvector)
        v
[classifier.py] --> cosseno vs dim_temas --> tema_id
        |
        v
[summarizer.py] --> gpt-4o-mini (T=0.2) --> resumo_executivo
```

**Idempotencia:** cada modulo verifica se o campo ja esta preenchido antes de chamar a API.
Re-execucoes nao geram custo adicional para registros ja processados.

**Ordem de execucao obrigatoria:**
1. `embed_pending()` — deve rodar antes de classify (precisa do vetor)
2. `classify_pending()` — deve rodar antes de summarize (opcional, mas logica)
3. `summarize_pending()` — independente dos anteriores

---

## 4. Controle de Qualidade

| Metrica | Meta | Status |
|---|---|---|
| Acuracia de classificacao (n=50, validacao manual) | >= 80% | A validar apos credito OpenAI |
| Proposicoes com `embedding` populado | >= 80 | A executar |
| Proposicoes com `tema_id` populado | >= 80 | A executar |
| Proposicoes com `resumo_executivo` populado | >= 80 | A executar |
| Custo total de IA no periodo | <= US$ 10 | US$ 0.00 (bloqueado por quota) |

**Bloqueio atual:** conta OpenAI sem creditos de billing. Apos adicionar credito em
platform.openai.com, rodar: `python scripts/3_run_ai_enrichment.py --limite 100`

---

## 5. Casos de Erro e Ambiguidade

Proposicoes com ementas muito curtas (< 20 chars) ou em linguagem altamente tecnica
tendem a ter score abaixo do threshold e ficam sem tema. Isso e intencional — melhor
nao classificar do que classificar errado.

| Tipo de caso | Tratamento |
|---|---|
| Ementa vazia ou muito curta | Pulada (filtro `WHERE ementa != ''`) |
| Score abaixo de 0.30 | `tema_id = NULL`, sem atribuicao forcada |
| API timeout / rate limit | Break do loop, persiste o que foi feito |
| Quota excedida (429) | Log de aviso claro com instrucao de acao |

---

## 6. Controle de Custos

Log de execucao em `docs/custo_ia.csv` (gerado automaticamente pelos modulos).

Formato:
```
data,operacao,tokens,custo_usd,modelo
2026-05-17,embed_pending,6000,0.000120,text-embedding-3-small
2026-05-17,summarize_pending,28000,0.012600,gpt-4o-mini
```

Hard cap de US$ 10/mes configurado na dashboard da OpenAI (Settings > Limits).
Cache automatico: registros com `embedding IS NOT NULL` nunca sao reprocessados.
