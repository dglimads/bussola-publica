# Imagens do dashboard

> **Atenção:** a galeria **Entregáveis → "Galeria de evidências"** lê as imagens da
> **raiz** de `dashboard/public/` (e não desta subpasta). Esta pasta `prints/` guarda
> apenas as **fotos da equipe** (`integrantes/`) e cópias avulsas.

## Galeria de evidências (em `dashboard/public/`)

A aba Entregáveis exibe, nesta ordem, as imagens abaixo. Cada quadro abre em tamanho
real ao clicar; se o arquivo não existir, aparece um placeholder com o nome esperado.

| Arquivo (em `public/`) | Conteúdo |
|---|---|
| `supabase-tabelas.png` | Supabase · Table Editor com tabelas populadas |
| `1-supabase-contagem-por-tabela.png` | Contagem de registros por tabela |
| `2-supabase-cobertura-temporal-30-dias.png` | Cobertura temporal (≥ 30 dias) |
| `3-supabase_status-da-IA.png` | Status do enriquecimento por IA |
| `4-supabase-top-temas.png` | Top temas classificados |
| `5-supabase-checagem-de-duplicidade.png` | Checagem de duplicidade |
| `6-supabase-checagem-nulos-em-campos-obrigatorios.png` | Nulos em campos obrigatórios |
| `7-supabase-resumo-executivo.png` | Resumo executivo gerado pela IA |
| `pipeline.png` | Pipeline rodando no terminal (E2E) |
| `ia-resumo.png` | Exemplos de resumo/classificação por IA |
| `custo-ia.png` | Controle de custo de IA (`docs/custo_ia.csv`) |
| `n8n-workflow.png` | n8n · workflow montado |
| `n8n-execucao.png` | n8n · execução bem-sucedida |
| `dashboard.png` | Dashboard · visão geral |
| `dashboard-radar-tematico.png` | Dashboard · radar temático (heatmap tema × partido) |
| `dashboard-atividade-parlamentar.png` | Dashboard · atividade parlamentar |
| `dashboard-votacoes.png` | Dashboard · votações (como cada partido votou) |
| `slides.png` | Apresentação executiva |

- Formatos: PNG ou JPG. Para adicionar/renomear, edite o array `PRINTS` em
  `dashboard/components/sections/Entregaveis.tsx`.
- Site **estático**: rode `npm run build` de novo após adicionar imagens.

## Outras pastas de `public/`

- `apresentacao/` — cópias de `p1-arquitetura.html` e `p2-resultados.html` servidas pelo site.
- `docs/prints/` — prints usados **dentro** das apresentações (espelho de `../../docs/prints/`).
- `n8n/` — `bussola_email_semanal.json` para download direto pelo painel.
- `prints/integrantes/` — fotos da equipe (aba Equipe).
