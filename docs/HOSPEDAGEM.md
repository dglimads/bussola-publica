# Como hospedar a Bússola Pública

Guia passo a passo para publicar o **dashboard** (e, junto com ele, as **apresentações**,
o **workflow n8n** e a **galeria de prints**) num link que a banca e a turma possam abrir.

---

## O que vai para o ar

O dashboard é um site **100% estático** (`next build` → pasta `dashboard/out/`). Ele lê o
Supabase **direto do navegador** (anon key, somente leitura) — **não precisa de servidor**.
Tudo abaixo é servido pelo mesmo link:

| Conteúdo | Caminho no site |
|---|---|
| Dashboard ao vivo (9 abas) | `/` |
| Apresentação p1 · Arquitetura | `/apresentacao/p1-arquitetura.html` |
| Apresentação p2 · Resultados | `/apresentacao/p2-resultados.html` |
| Workflow n8n (download) | `/n8n/bussola_email_semanal.json` |
| Galeria de evidências (prints) | aba **Entregáveis** |

> As apresentações e o n8n vivem em `dashboard/public/`, então entram automaticamente no
> build estático. Sempre que mexer nelas (ou nos prints), rode `npm run build` de novo.

---

## Pré-requisito (1 minuto): a anon key do Supabase

O painel precisa da **anon/publishable key** (pública por design, somente leitura):

1. Supabase → **Project Settings → API → Project API keys**.
2. Copie a **`anon` `public`** (ou uma `sb_publishable_...`). **NUNCA** a `service_role`.

Você vai colar isso em duas variáveis (o host pergunta, ou ficam no `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://yipwbjexekvrqgnpvjfn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cole_a_anon_key>
```

> Em export estático, essas variáveis são **embutidas no build** — defina-as **antes** do
> `npm run build` (no host ou no `.env.local`).

---

## Opção A — Vercel (recomendada, ~5 min, zero config)

Melhor escolha para Next.js. A Vercel faz o build e te dá um link `https://...vercel.app`.

1. Suba o repositório para o GitHub (se ainda não estiver).
2. Acesse [vercel.com](https://vercel.com) → **Add New… → Project** → importe o repo.
3. Em **Configure Project**:
   - **Root Directory:** `dashboard`  ← importante (o app não está na raiz do repo).
   - Framework: **Next.js** (detectado sozinho).
4. **Environment Variables** → adicione as duas:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://yipwbjexekvrqgnpvjfn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sua anon key
5. **Deploy**. Em ~1 min sai a URL pública. Compartilhe com a banca/turma.

> A cada `git push` na branch, a Vercel republica sozinha.

---

## Opção B — Netlify

**B1. Via GitHub (build na Netlify):**
1. [netlify.com](https://netlify.com) → **Add new site → Import an existing project** → repo.
2. **Base directory:** `dashboard` · **Build command:** `npm run build` · **Publish directory:** `dashboard/out`.
3. **Site settings → Environment variables:** as duas `NEXT_PUBLIC_*`.
4. **Deploy**.

**B2. Drag-and-drop (sem GitHub):**
```bash
cd dashboard
# garanta NEXT_PUBLIC_* no .env.local antes (são embutidas no build)
npm install
npm run build          # gera dashboard/out/
```
Depois, em [app.netlify.com/drop](https://app.netlify.com/drop), **arraste a pasta `out/`**.

---

## Opção C — GitHub Pages (atenção ao subcaminho)

Funciona, mas o site usa **caminhos absolutos** (`/dashboard.png`, `/apresentacao/...`).

- **Sem dor de cabeça:** publique numa URL **na raiz** (domínio próprio, ou `usuario.github.io`).
- **Em subpasta** (`usuario.github.io/bussola-publica`): defina `basePath` **e** `assetPrefix`
  em `dashboard/next.config.mjs` (ex.: `basePath: '/bussola-publica'`) e ajuste os links
  absolutos — caso contrário a galeria e os links das apresentações dão 404. Por isso,
  para entrega rápida, **prefira Vercel ou Netlify** (servem na raiz, sem ajuste).

---

## Opção D — Compartilhar rápido (demo/local)

```bash
cd dashboard
npm run build
npx serve out          # serve localhost:3000 a partir do estático
```
Para expor temporariamente na internet (durante a apresentação): `npx localtunnel --port 3000`
ou `ngrok http 3000`.

---

## Como a banca acessa (depois de publicado)

1. Abre a **URL** → cai na **Visão Geral** (dados ao vivo do Supabase).
2. Navega pelas abas: Radar Temático, Atividade, Votações, IA, Alertas, Arquitetura, Sobre, **Entregáveis**, Equipe.
3. Em **Entregáveis**:
   - **Apresentação executiva** → "p1 · Arquitetura ↗ / p2 · Resultados ↗" (abre em nova guia) ou "baixar".
   - **Workflow n8n** → "baixar `.json`" e "ver print do workflow".
   - **Galeria de evidências** → clique em qualquer print para ver em tamanho real.

---

## Checklist final

- [ ] Anon key colada nas envs do host (ou no `.env.local` antes do build).
- [ ] `npm run build` rodou sem erro e gerou `dashboard/out/`.
- [ ] Abrir a URL: Visão Geral mostra números (não o banner amarelo de "configuração pendente").
- [ ] Entregáveis: as duas apresentações abrem e os prints aparecem.
- [ ] Download do `bussola_email_semanal.json` funciona.

## Segurança (pode publicar sem medo)

A anon/publishable key é **pública por design** e **somente leitura**, restrita às views
agregadas via RLS (`leitura_publica`). A `service_role` e o `DATABASE_URL` do pipeline
**nunca** vão para o front nem para o Git (`.env`/`.env.local` no `.gitignore`).
