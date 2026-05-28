# KB: Bussola Publica

Conhecimento especifico do projeto Bussola Publica — Pipeline ETL + IA da Camara dos Deputados.

## Quando usar este KB

Use este dominio quando trabalhar em qualquer parte do pipeline:
- Extracao da API da Camara
- Transformacao Pandas
- Carga PostgreSQL (Supabase)
- Enriquecimento IA (OpenAI)
- Orquestracao n8n

## Conteudo

| Arquivo | Topico |
|---------|--------|
| [api-camaradeps.md](api-camara.md) | Endpoints, paginacao, armadilhas de defaults |
| [upsert-patterns.md](upsert-patterns.md) | Padroes de upsert idempotente com COALESCE |
| [ai-pipeline.md](ai-pipeline.md) | Embedding, classificacao por cosseno, resumo LLM |
| [python-conventions.md](python-conventions.md) | Convencoes de codigo especificas do projeto |

## Relacao com outros KBs

| KB externo | Quando usar junto |
|-----------|------------------|
| `kb/python/` | Dataclasses, type hints, generators |
| `kb/sql-patterns/` | CTEs, window functions, otimizacao |
| `kb/supabase/` | pgvector, RLS, connection pooling |
| `kb/prompt-engineering/` | Prompt versionado do summarizer |
