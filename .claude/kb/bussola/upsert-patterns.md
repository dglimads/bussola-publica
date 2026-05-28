# Padroes de Upsert — Bussola Publica

Padroes de upsert idempotente para o modelo estrela da Bussola Publica.

---

## Padrao Base

```python
# src/load/upsert.py
from sqlalchemy import text

def upsert_dataframe(df, table_name, pk_cols, update_cols, engine):
    """Upsert idempotente via INSERT ... ON CONFLICT DO UPDATE."""
    records = df.to_dict(orient="records")
    cols = list(records[0].keys())
    
    col_names = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    pk_conflict = ", ".join(pk_cols)
    updates = ", ".join(
        f"{c} = EXCLUDED.{c}"
        for c in update_cols
    )
    
    sql = text(f"""
        INSERT INTO {table_name} ({col_names})
        VALUES ({placeholders})
        ON CONFLICT ({pk_conflict}) DO UPDATE SET
            {updates},
            ingested_at = NOW()
    """)
    
    with engine.begin() as conn:
        conn.execute(sql, records)
```

---

## Upsert com COALESCE (campos IA)

Campos de IA nao devem ser sobrescritos pelo ETL diario.
Usar COALESCE para preservar valor ja existente:

```sql
INSERT INTO fato_proposicoes (proposicao_id, ementa, tipo, tema_id, embedding, resumo_executivo)
VALUES (:proposicao_id, :ementa, :tipo, NULL, NULL, NULL)
ON CONFLICT (proposicao_id) DO UPDATE SET
    ementa = EXCLUDED.ementa,
    tipo = EXCLUDED.tipo,
    ingested_at = NOW(),
    -- Preservar campos IA se ja preenchidos:
    tema_id = COALESCE(fato_proposicoes.tema_id, EXCLUDED.tema_id),
    embedding = COALESCE(fato_proposicoes.embedding, EXCLUDED.embedding),
    resumo_executivo = COALESCE(fato_proposicoes.resumo_executivo, EXCLUDED.resumo_executivo)
```

---

## Ordem de Carga (FK)

```python
# run_pipeline.py — ordem obrigatoria
upsert_partidos(df_partidos, engine)      # 1. dim sem FK
upsert_deputados(df_deputados, engine)    # 2. FK: partido_id
upsert_proposicoes(df_props, engine)      # 3. FK: autor_id -> deputado_id
upsert_votacoes(df_votacoes, engine)      # 4. FK: proposicao_id (nullable)
upsert_despesas(df_despesas, engine)      # 5. FK: deputado_id
```

Nunca alterar esta ordem. Violacao de FK levanta `IntegrityError`.

---

## Estrategia por Tabela

| Tabela | PK | COALESCE em | Atualiza sempre |
|--------|----|-------------|-----------------|
| `dim_partidos` | `partido_id` | — | `sigla`, `nome` |
| `dim_deputados` | `deputado_id` | — | `nome`, `partido_id`, `uf`, `email` |
| `fato_proposicoes` | `proposicao_id` | `tema_id`, `embedding`, `resumo_executivo` | `ementa`, `tipo` |
| `fato_votacoes` | `votacao_id` | `proposicao_id` | `data`, `orgao`, `aprovacao` |
| `fato_despesas` | `(cod_documento, parcela)` | `fornecedor_nome`, `fornecedor_cnpj` | `valor_*` |

---

## Preparacao do DataFrame antes do Upsert

```python
def prepare_for_upsert(df, pk_col):
    """Prepara DataFrame para upsert: remove PKs nulas e duplicatas."""
    df = df.dropna(subset=[pk_col])
    df = df.drop_duplicates(subset=[pk_col])
    df = df.reset_index(drop=True)
    return df
```

Sempre chamar antes de qualquer upsert.

---

## Anti-Patterns

| Nao faca | Faca |
|----------|------|
| `df.to_sql("tabela", engine, if_exists="replace")` | `upsert_dataframe(df, ...)` |
| `INSERT INTO ... VALUES (...)` puro | `INSERT ... ON CONFLICT DO UPDATE SET` |
| `engine.execute(sql)` | `with engine.begin() as conn: conn.execute(sql, records)` |
| Sobrescrever `tema_id` no ETL diario | COALESCE para preservar valor IA |
| Carregar deputados antes de partidos | Respeitar ordem de FK |
