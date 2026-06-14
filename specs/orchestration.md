# Spec: Orquestracao — Bussola Publica

**Status:** active
**Versao:** 2.0
**Ultima atualizacao:** 2026-06-14
**Implementacao:** `n8n/bussola_email_semanal.json`, `scripts/trigger_server.py`

---

## Contexto

Workflow n8n Cloud para envio de um **email semanal** com as 5 proposicoes mais
relevantes da semana para a equipe. O canal e **email** (Telegram foi removido).

A ingestao do pipeline (scripts 1 a 6) NAO e mais orquestrada pelo n8n nesta
versao — e executada manualmente (ou por agendamento externo). O n8n cuida
apenas do digest semanal, lendo direto do Postgres (Supabase). O
`trigger_server.py` continua disponivel como utilitario para acionar os scripts
via HTTP, mas nao e usado por este workflow.

---

## Diagrama do Workflow

```
[Cron Segunda 08:00 BRT]   (0 8 * * 1, timezone America/Sao_Paulo)
      |
      v
[PostgreSQL Query] ─── Top 5 proposicoes da semana
      |                 (ultimos 7 dias; ORDER BY critico DESC, qtd_autores DESC, data DESC)
      v
[Code] ─── Monta email HTML (cards por proposicao; sem itens -> nao envia)
      |
      v
[Send Email (SMTP)] ─── Envia para os 6 emails da equipe (teste)
```

Relevancia (criterio escolhido): **tema critico primeiro, depois maior numero de
autores** (coautoria como proxy de articulacao), desempate por data mais recente.

---

## Etapas do Workflow

### 1. Trigger — Cron Semanal

| Parametro | Valor |
|-----------|-------|
| Horario | Segunda-feira 08:00 BRT |
| Expressao cron | `0 8 * * 1` |
| Timezone | America/Sao_Paulo (definido em `settings.timezone` do workflow) |

### 2. Query — Top 5 da Semana

Le direto do Postgres (Supabase). Relevancia: tema critico, depois numero de
autores, desempate por data.

```sql
SELECT
    p.proposicao_id, p.tipo, p.ementa, p.resumo_executivo,
    p.qtd_autores, p.autor_principal_nome, p.data_apresentacao,
    t.nome    AS tema,
    t.critico AS critico
FROM fato_proposicoes p
LEFT JOIN dim_temas t ON p.tema_id = t.tema_id
WHERE p.data_apresentacao >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY
    COALESCE(t.critico, FALSE) DESC,
    COALESCE(p.qtd_autores, 0) DESC,
    p.data_apresentacao DESC
LIMIT 5;
```

`LEFT JOIN` em `dim_temas` porque `tema_id` pode ser nulo (proposicao ainda nao
classificada pela IA) — ela ainda pode entrar no Top 5.

### 3. Code — Monta Email HTML

Nodo `Code` (run once for all items) gera `{ subject, html }`. Um card por
proposicao com: badge critico/geral, tema, qtd de autores, autor principal,
tipo+id, ementa e resumo executivo. **Se a query retornar 0 linhas, o nodo
retorna `[]` e nenhum email e enviado** (semana sem proposicoes).

### 4. Send Email (SMTP) — Equipe

Nodo `emailSend` (SMTP) envia o HTML para os 6 emails da equipe (modo teste).
Destinatarios listados em `dashboard/lib/equipe.ts`. Telegram foi removido.

```
[Bussola Publica] Top 5 da semana (<DATA>)

[badge] <TEMA> · <N> autor(es) · <AUTOR PRINCIPAL>
<TIPO> <ID>
<EMENTA>
<RESUMO_EXECUTIVO>
---
[repete ate 5x]
```

---

## Requisitos

- **R1:** Query roda antes do envio; sem linhas -> nao envia email (nodo Code retorna `[]`)
- **R2:** Relevancia ordenada por `critico DESC, qtd_autores DESC, data DESC`
- **R3:** Janela fixa de 7 dias (`data_apresentacao >= CURRENT_DATE - 7`)
- **R4:** Canal exclusivamente email (SMTP); Telegram removido
- **R5:** Credenciais (Postgres e SMTP) armazenadas no n8n — nunca em JSON do workflow
- **R6:** Timezone do workflow fixado em America/Sao_Paulo

---

## Restricoes

- n8n Cloud free tier: max 5 workflows ativos
- Execucao manual disponivel via n8n UI (botao "Test workflow", sem aguardar o cron)
- Requer credencial Postgres (Supabase) e credencial SMTP configuradas no n8n
- Resumo executivo no email so existe se a IA (`3_run_ai_enrichment.py`) ja rodou; caso contrario o card mostra "Resumo por IA ainda nao gerado"

---

## Configuracao no n8n

1. **Credencial Postgres** ("Supabase Bussola Publica"): host/porta/db/usuario/senha do Supabase
2. **Credencial SMTP** ("SMTP Bussola Publica"): ex. Gmail SMTP (`smtp.gmail.com:465`, SSL) com App Password
3. Ajustar `fromEmail` no nodo "Envia email para a equipe" para o remetente real
4. Importar `n8n/bussola_email_semanal.json` e ativar o workflow
5. Teste imediato: botao "Test workflow" (executa fora do cron)

---

## Ingestao do Pipeline (fora do n8n)

Nesta versao a ingestao NAO e orquestrada pelo n8n — rodar manualmente para
manter os dados frescos antes do email semanal:

```bash
# Nucleo (incremental) + autoria + votos
python scripts/2_run_pipeline.py --incremental --with-authors --with-votes

# IA (proposicoes ja carregadas) -- alimenta tema/resumo usados no email
python scripts/3_run_ai_enrichment.py --limite 100

# Despesas CEAP (~20min, fora do escopo do Radar) -- pipeline proprio, por ultimo
python scripts/6_run_despesas.py --ano 2025
```

O `trigger_server.py` (rotas `/pipeline`, `/enrich`, `/authors`, `/votes`)
continua disponivel para acionar esses scripts via HTTP, caso se queira voltar a
orquestrar a ingestao pelo n8n no futuro.

---

## Open Questions

- [ ] Reintroduzir um workflow diario de ingestao (via trigger_server.py) se a frescura diaria for necessaria
- [ ] Dashboard Metabase/Grafana para visualizacao das proposicoes criticas
- [ ] Retry automatico do n8n em caso de falha de envio do email

---

## Changelog

- 2.0 (2026-06-14): n8n reduzido a um unico workflow de EMAIL SEMANAL (Top 5 da semana por tema critico + nr de autores) enviado a equipe; Telegram, Google Sheets e a orquestracao diaria da ingestao removidos do workflow; arquivo renomeado para n8n/bussola_email_semanal.json
- 1.2 (2026-06-14): Despesas CEAP desacopladas do pipeline principal -> pipeline proprio em scripts/6_run_despesas.py (extracao+carga isoladas, rodar por ultimo); flag --incluir-despesas removida dos scripts 1 e 2
- 1.1 (2026-06-14): Bridges de autoria e votos encadeados no workflow (rotas /authors e /votes via trigger_server.py); diagrama e execucao manual atualizados
- 1.0 (2026-05-17): Versao inicial baseada na configuracao do n8n descrita no PRD
