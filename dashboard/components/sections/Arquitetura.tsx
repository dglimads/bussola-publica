"use client";
import {
  Globe, Download, Filter, Database, Sparkles, Workflow, LayoutDashboard,
  ArrowRight, Save, RefreshCw, Bot, ShieldCheck, Network, type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";

type Stage = { ico: LucideIcon; titulo: string; tech: string; desc: string };
const PIPE: Stage[] = [
  { ico: Globe, titulo: "Fonte", tech: "API Câmara v2", desc: "/deputados, /proposicoes, /votacoes, /partidos, /despesas." },
  { ico: Download, titulo: "Extract", tech: "Python · requests", desc: "Paginação + retry exponencial; JSON bruto salvo em disco." },
  { ico: Filter, titulo: "Transform", tech: "Pandas", desc: "Valida, tipifica, deduplica; inválidos → quarentena." },
  { ico: Database, titulo: "Load", tech: "SQLAlchemy · Postgres", desc: "Upsert idempotente (ON CONFLICT) no modelo estrela." },
  { ico: Sparkles, titulo: "Enrich (IA)", tech: "OpenAI · pgvector", desc: "Embedding + cosseno → tema; gpt-4o-mini → resumo." },
  { ico: Workflow, titulo: "Orquestração", tech: "n8n", desc: "E-mail semanal (segunda 08h) com o Top 5 da semana para a equipe." },
  { ico: LayoutDashboard, titulo: "Dashboard", tech: "Next.js · Supabase", desc: "Este painel: leitura ao vivo via views agregadas." },
];

type Tbl = { nome: string; kind: "dim" | "fato" | "ponte"; cols: { c: string; key?: "pk" | "fk" | "ia" }[] };
const MODELO: Tbl[] = [
  { nome: "dim_partidos", kind: "dim", cols: [{ c: "partido_id", key: "pk" }, { c: "sigla" }, { c: "nome" }] },
  { nome: "dim_deputados", kind: "dim", cols: [{ c: "deputado_id", key: "pk" }, { c: "nome" }, { c: "partido_id", key: "fk" }, { c: "uf" }, { c: "email" }] },
  { nome: "dim_temas", kind: "dim", cols: [{ c: "tema_id", key: "pk" }, { c: "nome" }, { c: "critico" }] },
  { nome: "fato_proposicoes", kind: "fato", cols: [{ c: "proposicao_id", key: "pk" }, { c: "tipo" }, { c: "ementa" }, { c: "tema_id", key: "ia" }, { c: "embedding", key: "ia" }, { c: "resumo_executivo", key: "ia" }, { c: "autores_carregados" }] },
  { nome: "ponte_proposicao_autores", kind: "ponte", cols: [{ c: "proposicao_id", key: "fk" }, { c: "deputado_id", key: "fk" }, { c: "partido_id", key: "fk" }, { c: "autor_tipo" }, { c: "proponente" }, { c: "ordem_assinatura" }] },
  { nome: "fato_votacoes", kind: "fato", cols: [{ c: "votacao_id", key: "pk" }, { c: "proposicao_id", key: "fk" }, { c: "orgao" }, { c: "aprovacao" }, { c: "qtd_votos" }] },
  { nome: "fato_votacao_votos", kind: "fato", cols: [{ c: "votacao_id", key: "fk" }, { c: "deputado_id", key: "fk" }, { c: "tipo_voto" }, { c: "sigla_partido_voto" }] },
  { nome: "fato_despesas", kind: "fato", cols: [{ c: "cod_documento+parcela", key: "pk" }, { c: "deputado_id", key: "fk" }, { c: "valor_liquido" }, { c: "fornecedor_cnpj" }] },
];

type Dec = { ico: LucideIcon; titulo: string; texto: string; why: string };
const DECISOES: Dec[] = [
  { ico: Save, titulo: "JSON bruto antes do transform", texto: "A extração persiste o JSON cru em disco antes de qualquer transformação.", why: "Se o transform quebra, não chama a API de novo — extrai uma vez, transforma quantas quiser." },
  { ico: Database, titulo: "Modelo dimensional estrela", texto: "Dimensões (partidos, deputados, temas) + fatos (proposições, votações, despesas).", why: "Consultas analíticas simples e relacionamentos claros por FK." },
  { ico: Network, titulo: "Autoria N:N via tabela ponte", texto: "O endpoint /proposicoes não traz o autor; ele vem de /proposicoes/{id}/autores. A relação é N:N → ponte_proposicao_autores.", why: "Uma proposição tem vários autores e um autor assina várias — uma coluna autor_id única falharia. A ponte destrava o heatmap tema × partido e o voto nominal por deputado." },
  { ico: Sparkles, titulo: "Classificação por embeddings", texto: "text-embedding-3-small + similaridade de cosseno contra 10 temas; threshold 0,30.", why: "~50x mais barato e mais rápido que LLM-as-judge; abaixo do threshold fica sem tema (não força)." },
  { ico: Bot, titulo: "Resumo com gpt-4o-mini (T=0.2)", texto: "Persona de analista de Relações Governamentais; máx. 3 linhas, 200 tokens.", why: "Qualidade equivalente ao gpt-4o por fração do custo; T baixa favorece factualidade." },
  { ico: RefreshCw, titulo: "Upsert idempotente", texto: "INSERT … ON CONFLICT DO UPDATE; COALESCE preserva campos de IA já gerados.", why: "Re-execução diária não duplica nem reprocessa o que já foi feito." },
  { ico: ShieldCheck, titulo: "Hardening para publicação", texto: "RLS de leitura pública + anon restrito às views agregadas (sem tabelas-base).", why: "Painel público sem expor e-mails, CNPJs ou linhas cruas; escrita só via service_role." },
];

export function Arquitetura() {
  return (
    <div className="stack">
      <Panel>
        <div className="page-intro">
          <Eyebrow color="#3BE0C9">Documentação técnica</Eyebrow>
          <h2>Arquitetura do pipeline</h2>
          <p>
            Do dado público ao sinal acionável em seis estágios automatizados — Python/Pandas para ETL,
            PostgreSQL/Supabase para persistência, OpenAI para a camada de IA e n8n para orquestração e alertas.
          </p>
        </div>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#7CC4FF">Fluxo end-to-end</Eyebrow><h3>Extract → Transform → Load → IA → Orquestração → Dashboard</h3></div></div>
        <div className="pipe">
          {PIPE.map((s, i) => (
            <div key={s.titulo} style={{ display: "contents" }}>
              <div className="pipe-step">
                <span className="pipe-ico"><s.ico size={17} strokeWidth={2} /></span>
                <h4>{s.titulo}</h4>
                <span className="pipe-tech">{s.tech}</span>
                <span className="pipe-desc">{s.desc}</span>
              </div>
              {i < PIPE.length - 1 && <span className="pipe-arrow"><ArrowRight size={16} /></span>}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="panel-head">
          <div><Eyebrow color="#E5B567">Modelo de dados</Eyebrow><h3>Esquema estrela · 8 tabelas</h3></div>
          <span className="muted-tag"><Network size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />dim → fato</span>
        </div>
        <div className="modelo-grid">
          {MODELO.map((t) => (
            <div key={t.nome} className={`tbl-card ${t.kind}`}>
              <h4>{t.nome}<span className="tbl-kind">{t.kind}</span></h4>
              {t.cols.map((col) => (
                <div key={col.c} className="col">
                  <span className="cn">{col.c}</span>
                  {col.key && <span className={`keytag ${col.key}`}>{col.key === "ia" ? "IA" : col.key.toUpperCase()}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="caption">
          <b>PK</b> chave primária · <b>FK</b> chave estrangeira · <b>IA</b> campo preenchido pela camada de IA.
          Relações: <code>deputados → partidos</code>; <code>proposições ⇄ autores</code> (ponte N:N); <code>votações → proposições</code>; <code>votos/despesas → deputados</code>.
        </p>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#3BE0C9">Decisões de arquitetura</Eyebrow><h3>O que foi escolhido e por quê</h3></div></div>
        <div className="dec-grid">
          {DECISOES.map((d) => (
            <div key={d.titulo} className="dec-card">
              <h4><d.ico size={15} strokeWidth={2} /> {d.titulo}</h4>
              <p>{d.texto}</p>
              <span className="dec-why"><b>Por quê:</b> {d.why}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#E5B567">Camada de IA</Eyebrow><h3>Prompt versionado — resumo executivo</h3></div><span className="muted-tag">gpt-4o-mini · T=0.2</span></div>
        <div className="prompt">
          <pre>{``}<span className="pr-role">[system]</span>{`
Você é um analista sênior de Relações Governamentais.
Sua tarefa é resumir uma proposição legislativa em até 3 linhas,
em linguagem clara e direta para um executivo de empresa regulada.
Não use jargão jurídico desnecessário. Não opine. Não invente.
Se a ementa for curta ou ambígua, resuma o que estiver disponível.

`}<span className="pr-role">[user]</span>{`
Proposição ({tipo}):
"""{ementa}"""

Resumo executivo (máx. 3 linhas):`}</pre>
        </div>
        <p className="caption">
          Classificação temática: <code>text-embedding-3-small</code> → vetor 1536D em <code>pgvector</code> → similaridade de
          cosseno contra <code>dim_temas</code> (atribui o tema se score ≥ 0,30). Custo registrado em <code>docs/custo_ia.csv</code>, hard cap de US$ 10/mês.
        </p>
      </Panel>
    </div>
  );
}
