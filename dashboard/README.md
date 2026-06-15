# Bússola Legislativa — Dashboard em tempo real

Front-end **Next.js** (App Router + TypeScript) que lê **ao vivo** o Supabase/PostgreSQL do
pipeline **Bússola Pública** e responde, em tempo real, todas as perguntas sobre a base
da Câmara dos Deputados — mais as páginas de portfólio do **Data Challenge Xperiun · Radar
Legislativo** (arquitetura, README, entregáveis e equipe).

Os números **nunca são hardcoded** — vêm de _views_ agregadas no Postgres, consumidas pela
`anon`/`publishable` key (somente leitura). O visual é o snapshot aprovado em
`../bussola_legislativa.jsx` portado 1:1 (mesmo CSS, cores por tema, radar, componentes).

---

## Stack

- **Next.js 16** (App Router, TypeScript, **static export**) · **React 19**
- **@supabase/supabase-js** — cliente no browser com a anon/publishable key
- **recharts** — gráficos · **lucide-react** — ícones · **swr** — polling/refresh (60s)
- Sem Tailwind: o visual vem inteiramente do CSS portado em `app/globals.css`
- `npm audit` → **0 vulnerabilidades**

---

## Como rodar (local)

```bash
cd dashboard
npm install

cp .env.local.example .env.local       # (Windows: copy ...)
# edite .env.local e cole sua NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev        # http://localhost:3000
```

> Use **apenas a anon key** ou a **publishable key** (`sb_publishable_...`): públicas por design,
> somente leitura, mapeadas ao role `anon`. **Nunca** a `service_role`.
> No Supabase: **Project Settings → API → Project API keys** (ou Publishable keys).

---

## Páginas

**Dados ao vivo (Supabase):**
`Visão Geral` · `Radar Temático` · `Atividade Parlamentar` · `Votações` · `IA Legislativa` · `Alertas`

**Portfólio / entrega (Data Challenge):**
- `Arquitetura` — diagrama do pipeline, modelo estrela (tabelas/colunas/relacionamentos), decisões e prompt de IA.
- `Sobre` — o README como página: problema, solução, como rodar, stack e roadmap.
- `Entregáveis` — checklist dos 5 entregáveis + critérios de avaliação + **galeria de prints**.
- `Equipe` — integrantes do grupo (nome, e-mail, telefone).

### Prints, apresentações e workflow (aba Entregáveis)

- **Galeria de evidências** — lê as imagens da **raiz** de [`public/`](public/prints/README.md)
  (`supabase-*.png`, `pipeline.png`, `n8n-*.png`, `dashboard*.png`, `slides.png`, …). Cada
  print **abre em tamanho real ao clicar**; sem o arquivo, mostra um placeholder.
- **Apresentação executiva** — abre em nova guia / baixa `apresentacao/p1-arquitetura.html`
  e `apresentacao/p2-resultados.html` (cópias servidas pelo próprio site estático).
- **Workflow n8n** — baixa `n8n/bussola_email_semanal.json` e exibe `n8n-workflow.png`.

> Essas pastas (`apresentacao/`, `docs/prints/`, `n8n/`) ficam em `public/` e por isso
> entram automaticamente no build estático (`out/`). Rode `npm run build` após alterá-las.

---

## Banco: aplicar o SQL

Toda a agregação roda no Postgres. Dois arquivos, **já aplicados** neste projeto via Supabase MCP:

1. [`sql/views_dashboard.sql`](sql/views_dashboard.sql) — 23 views + a RPC `fn_proposicoes_enriquecidas`
   + RLS de leitura pública (migration `dashboard_views_rls`).
2. [`sql/02_hardening_public.sql`](sql/02_hardening_public.sql) — **hardening para publicação** (migration
   `dashboard_hardening_public`): revoga a leitura direta das tabelas-base do `anon`, deixando apenas
   as views agregadas + a RPC.

Para reaplicar/auditar: cole o conteúdo no **SQL Editor** do Supabase (ou `supabase db push`).

---

## Segurança (pronto para publicar)

| Item | Posture |
|---|---|
| **RLS** | Habilitada nas 6 tabelas; policy `leitura_publica` apenas de **SELECT**. |
| **Escrita por anon** | **Bloqueada** (nenhuma policy de INSERT/UPDATE/DELETE). Escrita só via `service_role`/`DATABASE_URL` do pipeline. |
| **Superfície do anon** | Restrita às **views agregadas** + RPC. Tabelas-base (e-mails, CNPJs, linhas cruas) **não** são legíveis. |
| **Chave no browser** | `anon`/`publishable` é pública por design (read-only). `.env.local` no `.gitignore`; nada de `service_role`. |
| **Realtime** | Desligado por padrão (`NEXT_PUBLIC_ENABLE_REALTIME=false`) — exige leitura de tabela-base. O polling de 60s mantém o painel vivo. |

> Verificado com a anon key: views/RPC → HTTP 200; `fato_despesas`/`dim_deputados` diretos → **401 permission denied**.

---

## Hospedar (portfólio)

O build gera um site **100% estático** (`output: 'export'`), hospedável em qualquer lugar:

```bash
npm run build          # gera a pasta out/
```

Suba o conteúdo de `out/` para o host. As duas variáveis `NEXT_PUBLIC_*` são embutidas no
build (a publishable key é pública por design) — configure-as no host **ou** no `.env.local` antes do build.

| Host | Como |
|---|---|
| **Vercel** | Importar o repo, root = `dashboard/`, definir as 2 envs `NEXT_PUBLIC_*`. Zero config. |
| **Netlify** | Build `npm run build`, publish dir `dashboard/out`. Ou arraste a pasta `out/` no drop. |
| **GitHub Pages** | Suba `out/` (defina `basePath`/`assetPrefix` no `next.config.mjs` se for sob subpasta `usuario.github.io/repo`). |
| **Cloudflare Pages / S3 / Nginx** | Servir `out/` como diretório estático. |

> O painel chama o Supabase direto do browser — não precisa de servidor Node em produção.

---

## Estrutura

```
dashboard/
  app/                     layout.tsx · page.tsx · globals.css (CSS portado 1:1)
  components/
    Dashboard.tsx          shell: 10 abas, hero+radar, env-banner, nav entre abas
    sections/              VisaoGeral, RadarTematico, Atividade, Votacoes, IALegislativa,
                           Alertas, Arquitetura, Sobre, Entregaveis, Equipe
    ui/                    Panel, KpiCard, Eyebrow, Note, RadarSignature, Skeleton,
                           PrintFrame, chartTheme
  lib/
    supabaseClient.ts · queries.ts · types.ts · format.ts · temas.ts
    equipe.ts · projeto.ts · nav.ts · useRealtimeRefresh.ts
  public/prints/           screenshots dos entregáveis (+ README com os nomes)
  sql/                     views_dashboard.sql · 02_hardening_public.sql
```

---

## Catálogo: cada view e a pergunta que responde

| View / RPC | Pergunta |
|---|---|
| `vw_kpis` | Quantas proposições/deputados/partidos/votações/despesas? Período? Última carga? Cobertura de IA? |
| `vw_proposicoes_por_tipo` / `_por_tema` / `_por_ano` | Composição por tipo, tema e ano |
| `vw_proposicoes_serie_diaria` / `_semanal` | Evolução diária e semanal |
| `vw_proposicoes_score` / `fn_proposicoes_enriquecidas` | Score de relevância + explorador filtrável (tema/tipo/busca) |
| `vw_deputados_por_partido` / `_por_uf` | Bancada por partido · deputados por UF |
| `vw_proposicoes_por_partido_autor` / `vw_top_deputados_autoria` | Autoria *(ativa quando `autor_id` existir)* |
| `vw_despesas_por_partido` / `_por_categoria` / `_serie_mensal` | Despesa por partido, categoria, mês |
| `vw_top_deputados_despesa` / `vw_top_fornecedores` | Top deputados e fornecedores (CEAP) |
| `vw_votacoes_resumo` / `_por_orgao` / `_serie` | Votações: total/aprovação, por órgão, por data |
| `vw_criticas_classificadas_recentes` | Monitoramento de temas críticos |
| `vw_data_quality` | Observabilidade: sem tema / sem resumo / sem autor / votações sem vínculo |

---

## Lacunas conhecidas (empty-states data-driven que se auto-resolvem)

1. **`autor_id` 100% nulo** → autoria oculta; usa bancada + cota CEAP. Aparece sozinha quando preenchido.
2. **Cobertura de IA parcial** → funil real (tema/resumo/embedding/pendentes) sempre do banco.
3. **Votações sem `proposicao_id`** → cruzamentos "preparados para evolução"; mostra órgão/data/aprovação.
4. **Despesas = base carregada** → rotuladas como tal, nunca como a Câmara inteira.

---

*Pós-Tech Engenharia de Dados Xperiun — Projeto Integrador: Radar Legislativo (2026)*
