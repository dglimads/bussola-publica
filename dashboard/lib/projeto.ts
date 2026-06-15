// Metadados do projeto - usados nas paginas Sobre / Arquitetura / Entregaveis / Equipe.
export const PROJETO = {
  nome: "Bússola Pública",
  subtitulo: "Radar Legislativo Inteligente",
  curso: "Pós-Tech Engenharia de Dados — Xperiun",
  desafio: "Data Challenge Xperiun · Projeto Integrador: Radar Legislativo",
  janela: "13/Mai/2026 — 15/Jun/2026",

  // Ajuste o repoUrl se o repositorio publico tiver outro caminho.
  repoUrl: "https://github.com/dglimads/bussola-publica",
  supabaseDashboard: "https://supabase.com/dashboard/project/yipwbjexekvrqgnpvjfn",
  supabaseRest: "https://yipwbjexekvrqgnpvjfn.supabase.co",
  apiCamara: "https://dadosabertos.camara.leg.br/api/v2",
  apiCamaraDocs: "https://dadosabertos.camara.leg.br/swagger/api.html",

  // Caminho do workflow no repositorio (rotulo) + copia servida pelo site (download).
  n8nWorkflow: "n8n/bussola_email_semanal.json",
  n8nWorkflowDownload: "/n8n/bussola_email_semanal.json",
  n8nWorkflowPrint: "/n8n-workflow.png",

  // Apresentacoes HTML servidas pelo proprio dashboard (public/apresentacao/).
  // Abrem em nova guia e podem ser baixadas (atributo download).
  slideArquitetura: "/apresentacao/p1-arquitetura.html",
  slideResultados: "/apresentacao/p2-resultados.html",
} as const;
