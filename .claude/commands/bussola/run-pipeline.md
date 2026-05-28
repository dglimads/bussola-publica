---
description: Executa o pipeline ETL da Bussola Publica (extract + transform + load + IA opcional)
---

Execute o pipeline da Bussola Publica seguindo as especificacoes em `specs/`.

## Contexto

Projeto: Pipeline ETL + IA da Camara dos Deputados
Stack: Python 3.14, pandas, SQLAlchemy, Supabase (PostgreSQL + pgvector)
Specs: `specs/extract.md`, `specs/transform.md`, `specs/ai-enrichment.md`

## Instrucoes

1. Verifique se o `.venv` esta ativo e `DATABASE_URL` esta configurada
2. Pergunte ao usuario qual modo deseja executar:
   - **incremental** (padrao diario): `run_pipeline.py --incremental`
   - **completo** (sem CEAP): `run_pipeline.py`
   - **so carga** (raw ja extraido): `run_pipeline.py --apenas-carga`
   - **com CEAP** (~20min): `run_extraction.py --incluir-despesas --ano-despesas 2025` + `run_pipeline.py --apenas-carga`
   - **com IA**: adicionar `run_ai_enrichment.py --limite 50` apos o pipeline
3. Execute os comandos na ordem correta
4. Reporte os totais carregados por tabela
5. Se houver erro, consulte a secao 12 do CLAUDE.md

## Comandos de referencia

```bash
# Ativar venv
.venv\Scripts\activate

# Verificar config
python -c "from src.config import config; print(config)"

# Pipeline incremental (uso diario)
python scripts/run_pipeline.py --incremental

# Pipeline completo do zero
python scripts/run_extraction.py
python scripts/run_pipeline.py --apenas-carga

# Com IA (se OPENAI_API_KEY configurada)
python scripts/run_ai_enrichment.py --limite 50
```

## Checklist pos-execucao

- [ ] Nenhum erro de FK (verificar logs)
- [ ] Contagem de registros plausivel (513 deputados, 21 partidos, etc.)
- [ ] Re-execucao idempotente (rodar novamente nao duplica registros)
