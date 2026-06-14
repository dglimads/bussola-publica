"use client";
import { Github, ExternalLink, Database, Target, Rocket, Workflow } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PROJETO } from "@/lib/projeto";

const ETAPAS = [
  { k: "Extract", v: "Extrai diariamente da API pública da Câmara (requests + paginação + retry)." },
  { k: "Transform", v: "Valida, tipifica e deduplica com Pandas; inválidos vão para quarentena." },
  { k: "Load", v: "Persiste em PostgreSQL/Supabase com modelo estrela e upsert idempotente." },
  { k: "Enrich (IA)", v: "Classifica por tema (embeddings + cosseno) e gera resumo executivo (gpt-4o-mini)." },
  { k: "Alert (n8n)", v: "Cron diário 06h + alerta quando uma proposição de tema crítico aparece." },
];

const STACK = [
  ["Linguagem", "Python 3.14"],
  ["HTTP + Retry", "requests + tenacity"],
  ["Transformação", "pandas"],
  ["ORM / Driver", "SQLAlchemy + psycopg2"],
  ["Banco", "PostgreSQL · Supabase"],
  ["Vetores", "pgvector (1536D)"],
  ["IA — Embeddings", "text-embedding-3-small"],
  ["IA — Resumo", "gpt-4o-mini (T=0.2)"],
  ["Orquestração", "n8n Cloud"],
  ["Dashboard", "Next.js + Recharts"],
];

const ROADMAP = [
  "Ponte proposição↔autor (N:N) para ativar autoria por deputado/partido",
  "Vínculo votação↔proposição + voto nominal por deputado",
  "RAG sobre o histórico legislativo (pgvector + LLM)",
  "Cobertura do Senado e TSE — visão legislativa 360°",
  "Índices HNSW no pgvector + CI/CD com GitHub Actions",
];

export function Sobre() {
  return (
    <div className="stack">
      <Panel>
        <div className="page-intro">
          <Eyebrow color="#3BE0C9">Sobre o projeto · README</Eyebrow>
          <h2>{PROJETO.nome} — {PROJETO.subtitulo}</h2>
          <p>
            Pipeline ETL + IA que captura o oceano de dados públicos da Câmara dos Deputados, organiza num modelo
            dimensional no PostgreSQL e enriquece com IA generativa — transformando manchete e boato em <b>sinal acionável</b>.
            Inteligência legislativa que consultorias de Relações Governamentais vendem por cinco dígitos/mês, automatizada de ponta a ponta.
          </p>
          <div className="lead-tags">
            <span className="cyan">{PROJETO.desafio}</span>
            <span>{PROJETO.curso}</span>
            <span>{PROJETO.janela}</span>
          </div>
        </div>
        <div className="linkbar" style={{ marginTop: 16 }}>
          <a className="linkbtn" href={PROJETO.repoUrl} target="_blank" rel="noreferrer">
            <Github size={16} /><span className="lb-main">Repositório<span className="lb-sub">GitHub · pipeline + README</span></span>
          </a>
          <a className="linkbtn" href={PROJETO.supabaseDashboard} target="_blank" rel="noreferrer">
            <Database size={16} /><span className="lb-main">Banco ao vivo<span className="lb-sub">Supabase · PostgreSQL</span></span>
          </a>
          <a className="linkbtn" href={PROJETO.apiCamaraDocs} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /><span className="lb-main">API da Câmara<span className="lb-sub">Dados Abertos · Swagger</span></span>
          </a>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#FF5C6C">Contexto</Eyebrow><h3>O problema</h3></div><Target size={16} style={{ color: "#FF5C6C" }} /></div>
          <p className="caption" style={{ marginTop: 0, fontSize: 12.5 }}>
            Consultorias monitoram <b>manualmente</b> o portal da Câmara: analistas sobrecarregados, histórico fragmentado em
            planilhas pessoais, classificação temática inconsistente e alertas que dependem da memória humana. O custo cresce
            linearmente com o número de clientes. O problema não é falta de dado — é falta de <b>engenharia de dados</b>.
          </p>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#3BE0C9">A solução</Eyebrow><h3>Pipeline em 5 etapas</h3></div><Workflow size={16} style={{ color: "#3BE0C9" }} /></div>
          <div className="deliv">
            {ETAPAS.map((e) => (
              <div key={e.k} className="deliv-row" style={{ padding: "9px 4px" }}>
                <span className="part-chip" style={{ minWidth: 78, textAlign: "center" }}>{e.k}</span>
                <div className="deliv-main"><span className="deliv-desc" style={{ color: "var(--dim)" }}>{e.v}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Para rodar</Eyebrow><h3>Este dashboard</h3></div></div>
          <div className="prompt"><pre>{`cd dashboard
npm install
cp .env.local.example .env.local   # cole a anon/publishable key
npm run dev                        # http://localhost:3000

# build estatico para hospedar:
npm run build                      # gera a pasta out/`}</pre></div>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow>Para rodar</Eyebrow><h3>O pipeline (Python)</h3></div></div>
          <div className="prompt"><pre>{`python scripts/explore_api.py            # valida a API
python scripts/1_run_extraction.py         # extrai raw -> data/raw/
python scripts/2_run_pipeline.py --apenas-carga
python scripts/3_run_ai_enrichment.py --limite 100`}</pre></div>
        </Panel>
      </div>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#E5B567">Tecnologias</Eyebrow><h3>Stack</h3></div></div>
        <div className="stack-grid">
          {STACK.map(([camada, tech]) => (
            <div key={camada} className="stack-row"><span className="sk-camada">{camada}</span><span className="sk-tech">{tech}</span></div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#3BE0C9">Próximos passos</Eyebrow><h3>Roadmap pós-V1</h3></div><Rocket size={16} style={{ color: "#3BE0C9" }} /></div>
        <ul className="score-legend">
          {ROADMAP.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
