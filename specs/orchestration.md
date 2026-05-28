# Spec: Orquestracao — Bussola Publica

**Status:** active
**Versao:** 1.0
**Ultima atualizacao:** 2026-05-17
**Implementacao:** `n8n/bussola_diario.json`

---

## Contexto

Workflow n8n Cloud para execucao diaria automatica do pipeline ETL + IA
e envio de alertas tematicos para stakeholders.

---

## Diagrama do Workflow

```
[Cron 06:00 BRT]
      |
      v
[Execute Command] ─── python scripts/run_pipeline.py --incremental
      |
      v
[PostgreSQL Query] ─── SELECT proposicoes criticas (tema.critico = TRUE)
      |
      ├── Se tem proposicoes criticas:
      |       v
      |   [Send Alert] ─── Email / Telegram com lista
      |
      └── Se nao tem:
              v
          [Log: sem alertas hoje]
      |
      v
[Google Sheets] ─── Append linha de log (opcional)
```

---

## Etapas do Workflow

### 1. Trigger — Cron Diario

| Parametro | Valor |
|-----------|-------|
| Horario | 06:00 BRT (America/Sao_Paulo) |
| Expressao cron | `0 9 * * 1-5` (09:00 UTC = 06:00 BRT, dias uteis) |
| Timezone | America/Sao_Paulo |

### 2. Extracao e Carga Incremental

```bash
python scripts/run_pipeline.py --incremental
```

Modo incremental: extrai apenas proposicoes e votacoes das ultimas 24h
(`data_inicio = hoje - 1 dia`). Despesas CEAP nao sao incrementais
(rodar separado com `--incluir-despesas` quando necessario).

### 3. Enriquecimento IA (opcional, diario)

```bash
python scripts/run_ai_enrichment.py --limite 50
```

Processa ate 50 proposicoes pendentes por dia (balanco custo/velocidade).

### 4. Query de Alertas

```sql
SELECT
    p.proposicao_id,
    p.tipo,
    p.ementa,
    p.resumo_executivo,
    t.nome AS tema
FROM fato_proposicoes p
JOIN dim_temas t ON p.tema_id = t.tema_id
WHERE
    t.critico = TRUE
    AND p.data_apresentacao >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY p.data_apresentacao DESC;
```

### 5. Alerta de Proposicoes Criticas

Enviado quando a query retorna >= 1 linha.
Canais configurados: Email (obrigatorio), Telegram (opcional).

Formato do alerta:
```
[Bussola Publica] Proposicoes criticas em <DATA>

Tema: <TEMA>
<TIPO> — <EMENTA>
Resumo: <RESUMO_EXECUTIVO>

---
[repete para cada proposicao]
```

### 6. Log de Execucao (Google Sheets — opcional)

| Coluna | Valor |
|--------|-------|
| data_execucao | Timestamp do cron |
| status | "OK" / "ERRO" |
| nr_proposicoes | Total carregado |
| nr_criticas | Total de alertas enviados |
| custo_ia_usd | Custo da rodada de IA |

---

## Requisitos

- **R1:** Pipeline incremental roda antes da query de alertas
- **R2:** Erro no pipeline nao deve enviar alerta (resultado inconsistente)
- **R3:** Alerta enviado apenas se `dim_temas.critico = TRUE`
- **R4:** Workflow configurado para dias uteis (segunda a sexta)
- **R5:** Credenciais n8n armazenadas em Environment Variables do n8n Cloud — nunca em JSON do workflow
- **R6:** Timeout de 30min para o comando de pipeline (pode demorar com CEAP)

---

## Restricoes

- n8n Cloud free tier: max 5 workflows ativos
- Execucao manual disponivel via n8n UI (sem aguardar o cron)
- Alertas so ativam se `OPENAI_API_KEY` estiver configurada (Sprint 3)

---

## Execucao Manual (bypass do cron)

Para rodar o pipeline fora do horario agendado:

```bash
# Pipeline completo (sem IA)
python scripts/run_pipeline.py

# Pipeline completo com CEAP (~20min)
python scripts/run_extraction.py --incluir-despesas --ano-despesas 2025
python scripts/run_pipeline.py --apenas-carga

# Apenas IA (proposicoes ja carregadas)
python scripts/run_ai_enrichment.py --limite 100
```

---

## Open Questions

- [ ] Webhook Telegram configurado (opcional para alertas em tempo real)
- [ ] Dashboard Metabase/Grafana para visualizacao das proposicoes criticas
- [ ] Retry automatico do n8n em caso de falha do comando Python

---

## Changelog

- 1.0 (2026-05-17): Versao inicial baseada na configuracao do n8n descrita no PRD
