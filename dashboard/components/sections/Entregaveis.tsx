"use client";
import {
  CheckCircle2, Github, Database, FileJson, FileText, ExternalLink, Camera,
  PlayCircle, Boxes, Sparkles, Workflow, MessageSquare, ArrowRight,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { PrintFrame } from "@/components/ui/PrintFrame";
import { PROJETO } from "@/lib/projeto";
import { navTo } from "@/lib/nav";

const PRINTS = [
  { src: "/prints/pipeline.png", titulo: "Pipeline rodando (terminal E2E)" },
  { src: "/prints/supabase-tabelas.png", titulo: "Supabase · tabelas populadas" },
  { src: "/prints/supabase-sql.png", titulo: "Supabase · SQL Editor / dados" },
  { src: "/prints/n8n-workflow.png", titulo: "n8n · workflow" },
  { src: "/prints/n8n-execucao.png", titulo: "n8n · execução bem-sucedida" },
  { src: "/prints/ia-resumos.png", titulo: "IA · resumos e classificação" },
  { src: "/prints/dashboard.png", titulo: "Dashboard · visão geral" },
  { src: "/prints/custo-ia.png", titulo: "Controle de custo de IA" },
  { src: "/prints/slides.png", titulo: "Apresentação executiva" },
];

const AVALIACAO = [
  { ico: PlayCircle, nome: "Funcionamento", sub: "Pipeline roda E2E, idempotente" },
  { ico: Boxes, nome: "Modelagem", sub: "Estrela · 6 tabelas, PK/FK claras" },
  { ico: Sparkles, nome: "IA aplicada", sub: "Tema + resumo no alerta, não decoração" },
  { ico: Workflow, nome: "Automação", sub: "n8n: cron diário + alerta crítico" },
  { ico: MessageSquare, nome: "Comunicação", sub: "README + painel + apresentação" },
];

export function Entregaveis() {
  return (
    <div className="stack">
      <Panel>
        <div className="page-intro">
          <Eyebrow color="#3BE0C9">Checklist da entrega</Eyebrow>
          <h2>Entregáveis</h2>
          <p>
            Mapa dos artefatos exigidos pelo desafio e onde cada um vive. Os prints dos entregáveis ficam na
            galeria abaixo — basta salvar as imagens em <code>public/prints/</code> com os nomes indicados.
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
              <span className="deliv-desc">Workflow diário versionado no repositório + print de execução bem-sucedida (galeria abaixo).</span>
              <span className="deliv-where" style={{ cursor: "default" }}><FileJson size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />{PROJETO.n8nWorkflow}</span>
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
              <span className="deliv-desc">Pitch: problema da Bússola Pública, solução, demo (prints do banco/dashboard/n8n) e próximos passos.</span>
              <span className="deliv-where" style={{ cursor: "default" }}><FileText size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />docs/slides/</span>
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
          <span className="muted-tag"><Camera size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />public/prints/</span>
        </div>
        <Note tone="cyan" icon={Camera}>
          Salve cada screenshot em <code>dashboard/public/prints/</code> com o nome mostrado em cada quadro (ex.: <code>pipeline.png</code>).
          Quem ainda não existir aparece como placeholder; assim que o arquivo for adicionado, a imagem aparece sozinha (rode <code>npm run build</code> de novo se for build estático).
        </Note>
        <div className="prints-grid" style={{ marginTop: 14 }}>
          {PRINTS.map((p) => (
            <PrintFrame key={p.src} src={p.src} titulo={p.titulo} hint={`salve em public${p.src}`} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
