# Pipeline de IA — Bussola Publica

Padroes e referencias para a camada de enriquecimento por IA (Sprint 3).

---

## Modelos em Uso

| Operacao | Modelo | Motivo |
|----------|--------|--------|
| Embedding | `text-embedding-3-small` | Custo US$0.02/1M tokens; 1536D suficiente |
| Resumo | `gpt-4o-mini` | Custo/qualidade ideal para 3 linhas |
| Classificacao | Cosine similarity (sem LLM) | 50x mais barato que LLM-as-judge |

---

## Fluxo Completo

```python
# scripts/run_ai_enrichment.py
from src.ai.embedder import embed_pending
from src.ai.classifier import classify_pending
from src.ai.summarizer import summarize_pending

# Ordem obrigatoria:
embed_pending(client, engine, limite=limite)       # gera VECTOR(1536)
classify_pending(client, engine, limite=limite)    # atribui tema_id
summarize_pending(client, engine, limite=limite)   # gera resumo_executivo
```

---

## Embedding (embedder.py)

```python
def embed_pending(client: OpenAI, engine, limite: int = 100) -> int:
    """Gera embeddings para proposicoes com embedding IS NULL."""
    proposicoes = fetch_pending_embed(engine, limite)
    for prop in proposicoes:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=prop["ementa"]
        )
        vetor = response.data[0].embedding  # list[float] de 1536 elementos
        update_embedding(engine, prop["proposicao_id"], vetor)
    return len(proposicoes)
```

---

## Classificacao por Cosseno (classifier.py)

```python
THRESHOLD = 0.30  # calibrado empiricamente

def classify_pending(client: OpenAI, engine, limite: int = 100) -> int:
    """Classifica proposicoes com embedding IS NOT NULL e tema_id IS NULL."""
    temas = fetch_temas_com_embedding(client, engine)  # gera on-demand
    proposicoes = fetch_pending_classify(engine, limite)
    
    for prop in proposicoes:
        scores = {
            tema["tema_id"]: cosine_similarity(prop["embedding"], tema["embedding"])
            for tema in temas
        }
        melhor_tema = max(scores, key=scores.get)
        melhor_score = scores[melhor_tema]
        
        if melhor_score >= THRESHOLD:
            update_tema(engine, prop["proposicao_id"], melhor_tema)
        # else: deixa tema_id = NULL (melhor nao classificar do que errar)
    
    return len(proposicoes)
```

---

## Resumo Executivo (summarizer.py)

```python
def summarize_pending(client: OpenAI, engine, limite: int = 100) -> int:
    """Gera resumos para proposicoes com resumo_executivo IS NULL."""
    with open("src/ai/prompts/resumo_executivo.md", encoding="utf-8") as f:
        system_prompt = f.read()
    
    proposicoes = fetch_pending_summarize(engine, limite)
    for prop in proposicoes:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            max_tokens=200,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prop["ementa"]}
            ]
        )
        resumo = response.choices[0].message.content.strip()
        update_resumo(engine, prop["proposicao_id"], resumo)
    
    return len(proposicoes)
```

---

## Idempotencia

Cada funcao filtra apenas registros PENDENTES:
- `embed_pending`: `WHERE embedding IS NULL AND ementa != ''`
- `classify_pending`: `WHERE embedding IS NOT NULL AND tema_id IS NULL`
- `summarize_pending`: `WHERE resumo_executivo IS NULL AND ementa != ''`

Re-executar nunca processa registros ja finalizados → custo zero adicional.

---

## Controle de Custo

```python
# Logar custo apos cada operacao
import csv
from datetime import date

def log_custo(operacao: str, tokens: int, modelo: str):
    custo = calcular_custo(tokens, modelo)
    with open("docs/custo_ia.csv", "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([date.today(), operacao, tokens, f"{custo:.6f}", modelo])
```

Hard cap: configurar em `platform.openai.com` → Settings → Limits: **US$10/mes**

---

## Queries de Monitoramento

```sql
-- Cobertura de IA
SELECT
    COUNT(*) AS total,
    COUNT(embedding) AS com_embedding,
    COUNT(tema_id) AS com_tema,
    COUNT(resumo_executivo) AS com_resumo
FROM fato_proposicoes;

-- Proposicoes criticas recentes
SELECT p.tipo, LEFT(p.ementa, 100), t.nome, p.resumo_executivo
FROM fato_proposicoes p
JOIN dim_temas t ON p.tema_id = t.tema_id
WHERE t.critico = TRUE AND p.data_apresentacao >= CURRENT_DATE - 7;
```
