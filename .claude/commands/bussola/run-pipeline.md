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
   - **incremental** (padrao diario): `2_run_pipeline.py --incremental`
   - **completo** (sem CEAP): `2_run_pipeline.py`
   - **so carga** (raw ja extraido): `2_run_pipeline.py --apenas-carga`
   - **despesas CEAP** (~20min, pipeline proprio, rodar por ultimo): `6_run_despesas.py --ano 2025`
   - **com IA**: adicionar `3_run_ai_enrichment.py --limite 50` apos o pipeline
   - **com autoria + votos** (roadmap pos V1): `4_run_authors_bridge.py --only-missing` + `5_run_votes_bridge.py --only-missing` (exige `sql/migration_autoria_votos.sql` aplicada)
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
python scripts/2_run_pipeline.py --incremental

# Pipeline completo do zero
python scripts/1_run_extraction.py
python scripts/2_run_pipeline.py --apenas-carga

# Com IA (se OPENAI_API_KEY configurada)
python scripts/3_run_ai_enrichment.py --limite 50

# Autoria (ponte N:N) + votos nominais — roadmap pos V1
python scripts/4_run_authors_bridge.py --only-missing
python scripts/5_run_votes_bridge.py --only-missing

# Despesas CEAP — pipeline proprio, por ultimo (lento, fora do escopo do Radar)
python scripts/6_run_despesas.py --ano 2025
```

## Checklist pos-execucao

- [ ] Nenhum erro de FK (verificar logs)
- [ ] Contagem de registros plausivel (513+ deputados, 21 partidos, etc.)
- [ ] Re-execucao idempotente (rodar novamente nao duplica registros)
- [ ] (se rodou bridges) ponte_proposicao_autores e fato_votacao_votos com registros; pipeline_erros sem surpresas
