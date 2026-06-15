"use client";
import type { CSSProperties } from "react";
import {
  CheckCircle2, Github, Database, FileJson, FileText, ExternalLink, Camera,
  PlayCircle, Boxes, Sparkles, Workflow, MessageSquare, ArrowRight, Download, FileImage,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { PrintFrame } from "@/components/ui/PrintFrame";
import { PROJETO } from "@/lib/projeto";
import { navTo } from "@/lib/nav";

// Galeria de evidencias: todas as imagens vivem em dashboard/public/ (raiz).
// Clicar abre em tamanho real (PrintFrame embrulha a img num <a target="_blank">).
const PRINTS = [
  { src: "/supabase-tabelas.png", titulo: "Supabase · tabelas populadas" },
  { src: "/1-supabase-contagem-por-tabela.png", titulo: "Supabase · contagem por tabela" },
  { src: "/2-supabase-cobertura-temporal-30-dias.png", titulo: "Supabase · cobertura temporal (30 dias)" },
  { src: "/3-supabase_status-da-IA.png", titulo: "Supabase · status da IA" },
  { src: "/4-supabase-top-temas.png", titulo: "Supabase · top temas" },
  { src: "/5-supabase-checagem-de-duplicidade.png", titulo: "Supabase · checagem de duplicidade" },
  { src: "/6-supabase-checagem-nulos-em-campos-obrigatorios.png", titulo: "Supabase · nulos em campos obrigatórios" },
  { src: "/7-supabase-resumo-executivo.png", titulo: "Supabase · resumo executivo (IA)" },
  { src: "/pipeline.png", titulo: "Pipeline rodando (terminal E2E)" },
  { src: "/ia-resumo.png", titulo: "IA · resumo e classificação" },
  { src: "/custo-ia.png", titulo: "Controle de custo de IA" },
  { src: "/n8n-workflow.png", titulo: "n8n · workflow" },
  { src: "/n8n-execucao.png", titulo: "n8n · execução bem-sucedida" },
  { src: "/dashboard.png", titulo: "Dashboard · visão geral" },
  { src: "/dashboard-radar-tematico.png", titulo: "Dashboard · radar temático" },
  { src: "/dashboard-atividade-parlamentar.png", titulo: "Dashboard · atividade parlamentar" },
  { src: "/dashboard-votacoes.png", titulo: "Dashboard · votações" },
  { src: "/slides.png", titulo: "Apresentação executiva" },
];

const AVALIACAO = [
  { ico: PlayCircle, nome: "Funcionamento", sub: "Pipeline roda E2E, idempotente" },
  { ico: Boxes, nome: "Modelagem", sub: "Estrela · 8 tabelas, PK/FK claras" },
  { ico: Sparkles, nome: "IA aplicada", sub: "Tema + resumo no alerta, não decoração" },
  { ico: Workflow, nome: "Automação", sub: "n8n: e-mail semanal Top 5" },
  { ico: MessageSquare, nome: "Comunicação", sub: "README + painel + apresentação" },
];

// Linhas de acoes (abrir/baixar) lado a lado, com quebra; .deliv-where ja tem width:fit-content.
const linksRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "5px 16px", marginTop: 3 };

export function Entregaveis() {
  return (
    <div className="stack">
      <Panel>
        <div className="page-intro">
          <Eyebrow color="#3BE0C9">Checklist da entrega</Eyebrow>
          <h2>Entregáveis</h2>
          <p>
            Mapa dos artefatos exigidos pelo desafio e onde cada um vive — com as <b>apresentações</b> e o
            <b> workflow n8n</b> prontos para abrir em nova guia ou baixar, e a galeria de evidências logo abaixo.
          </p>
        </div>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#6FCF97">Artefatos</Eyebrow><h3>O que foi entregue</h3></div></div>
        <div className="deliv">
          <div className="deliv-row">
            <span className="deliv-ico"><CheckCircle2 size={15} /></span>
            <div className="deliv-main">
              <span className="deliv-title">Repositório no GitHub</span>
              <span className="deliv-desc">Pipeline completo, scripts, README bem feito e instruções de como rodar.</span>
              <a className="deliv-where" href={PROJETO.repoUrl} target="_blank" rel="noreferrer"><Github size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />abrir repositório →</a>
            </div>
          </div>
          <div className="deliv-row">
            <span className="deliv-ico"><CheckCircle2 size={15} /></span>
            <div className="deliv-main">
              <span className="deliv-title">Banco PostgreSQL populado (≥ 30 dias)</span>
              <span className="deliv-desc">Supabase com 2003–2026 carregados — muito além dos 30 dias exigidos. Leitura pública via este painel.</span>
              <a className="deliv-where" href={PROJETO.supabaseDashboard} target="_blank" rel="noreferrer"><Database size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />abrir Supabase →</a>
            </div>
          </div>
          <div className="deliv-row">
            <span className="deliv-ico"><CheckCircle2 size={15} /></span>
            <div className="deliv-main">
              <span className="deliv-title">Workflow n8n exportado (.json)</span>
              <span className="deliv-desc">E-mail semanal Top 5 versionado no repositório. Baixe o <code>.json</code> para importar no n8n ou veja o print do workflow montado.</span>
              <div style={linksRow}>
                <a className="deliv-where" href={PROJETO.n8nWorkflowDownload} download><Download size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />baixar workflow (.json) →</a>
                <a className="deliv-where" href={PROJETO.n8nWorkflowPrint} download><FileImage size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />baixar print do workflow (.png) →</a>
              </div>
              <span className="deliv-where" style={{ cursor: "default", color: "var(--faint)" }}><FileJson size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />{PROJETO.n8nWorkflow}</span>
            </div>
          </div>
          <div className="deliv-row">
            <span className="deliv-ico"><CheckCircle2 size={15} /></span>
            <div className="deliv-main">
              <span className="deliv-title">Documentação técnica</span>
              <span className="deliv-desc">Diagrama do pipeline, modelo das tabelas, decisões de arquitetura e prompts de IA.</span>
              <button type="button" className="deliv-where" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={() => navTo("arquitetura")}>
                <FileText size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />ver aba Arquitetura <ArrowRight size={10} style={{ verticalAlign: "-1px" }} />
              </button>
            </div>
          </div>
          <div className="deliv-row">
            <span className="deliv-ico"><CheckCircle2 size={15} /></span>
            <div className="deliv-main">
              <span className="deliv-title">Apresentação executiva (≤ 6 slides)</span>
              <span className="deliv-desc">Pitch em dois decks HTML: <b>p1 · Arquitetura</b> (pipeline, modelo, IA) e <b>p2 · Resultados</b> (dados, CEAP, votações, dashboard ao vivo). Abra em nova guia ou baixe o arquivo.</span>
              <div style={linksRow}>
                <a className="deliv-where" href={PROJETO.slideArquitetura} target="_blank" rel="noreferrer"><ExternalLink size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />p1 · Arquitetura ↗</a>
                <a className="deliv-where" href={PROJETO.slideResultados} target="_blank" rel="noreferrer"><ExternalLink size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />p2 · Resultados ↗</a>
                <a className="deliv-where" href={PROJETO.slideArquitetura} download><Download size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />baixar p1</a>
                <a className="deliv-where" href={PROJETO.slideResultados} download><Download size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />baixar p2</a>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#E5B567">Critérios de avaliação</Eyebrow><h3>Como o projeto atende</h3></div></div>
        <div className="aval-grid">
          {AVALIACAO.map((a) => (
            <div key={a.nome} className="aval-card">
              <div className="av-ico"><a.ico size={20} strokeWidth={1.8} /></div>
              <div className="av-name">{a.nome}</div>
              <div className="av-sub">{a.sub}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="panel-head">
          <div><Eyebrow color="#3BE0C9">Prints dos entregáveis</Eyebrow><h3>Galeria de evidências</h3></div>
          <span className="muted-tag"><Camera size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />public/</span>
        </div>
        <Note tone="cyan" icon={Camera}>
          Evidências do projeto — banco (Supabase), pipeline, IA, custo, n8n e o dashboard ao vivo.
          Cada imagem vive em <code>dashboard/public/</code> e <b>abre em tamanho real ao clicar</b>.
        </Note>
        <div className="prints-grid" style={{ marginTop: 14 }}>
          {PRINTS.map((p) => (
            <PrintFrame key={p.src} src={p.src} titulo={p.titulo} hint={`salve em dashboard/public${p.src}`} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
