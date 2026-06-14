"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Sparkles, Search } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ChartSkeleton, PanelError } from "@/components/ui/Skeleton";
import { chartTooltip } from "@/components/ui/chartTheme";
import { corTema } from "@/lib/temas";
import { fmtInt, fmtDataBR, linkCamara } from "@/lib/format";
import {
  getKpis, getProposicoesPorTema, getProposicoesPorTipo, getProposicoesEnriquecidas,
} from "@/lib/queries";

export function IALegislativa() {
  const [tema, setTema] = useState("Todos");
  const [tipo, setTipo] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");

  // debounce da busca para nao disparar a RPC a cada tecla
  useEffect(() => {
    const id = setTimeout(() => setBuscaDeb(busca), 300);
    return () => clearTimeout(id);
  }, [busca]);

  const { data: kpis } = useSWR("kpis", getKpis);
  const { data: temas } = useSWR("prop_tema", getProposicoesPorTema);
  const { data: tipos } = useSWR("prop_tipo", getProposicoesPorTipo);
  const { data: lista, error, isLoading } = useSWR(
    ["enriquecidas", tema, tipo, buscaDeb],
    () => getProposicoesEnriquecidas({ tema, tipo, busca: buscaDeb, limit: 80 }),
    { keepPreviousData: true },
  );

  const temasOpt = useMemo(() => ["Todos", ...(temas ?? []).map((t) => t.tema)], [temas]);
  const tiposOpt = useMemo(() => ["Todos", ...(tipos ?? []).map((t) => t.tipo)], [tipos]);

  const proposicoes = kpis?.proposicoes ?? 0;
  const comTema = kpis?.com_tema ?? 0;
  const comResumo = kpis?.com_resumo ?? 0;
  const comEmbedding = kpis?.com_embedding ?? 0;
  const naFila = Math.max(0, proposicoes - comResumo);
  const cob = [
    { name: "Classificadas", value: comTema, cor: "#3BE0C9" },
    { name: "Resumidas (sem tema)", value: Math.max(0, comResumo - comTema), cor: "#7CC4FF" },
    { name: "Pendentes", value: naFila, cor: "#283449" },
  ];
  const itens = lista ?? [];

  return (
    <div className="stack">
      <Panel className="hero-ia">
        <Eyebrow color="#3BE0C9">A camada que diferencia o produto</Eyebrow>
        <h2 className="ia-title">Cada proposição vira <span className="grad">tema + resumo executivo</span> sem leitura humana.</h2>
        <p className="ia-sub">
          Embeddings <code>text-embedding-3-small</code> classificam a ementa por similaridade de cosseno contra {fmtInt(kpis?.temas ?? 10)} temas;
          o <code>gpt-4o-mini</code> gera o resumo de 3 linhas. Persistidos em <code>tema_id</code>, <code>resumo_executivo</code> e <code>embedding (pgvector)</code>.
        </p>
        <div className="ia-stats">
          <div><b style={{ color: "#3BE0C9" }}>{fmtInt(comTema)}</b><span>classificadas</span></div>
          <div><b style={{ color: "#7CC4FF" }}>{fmtInt(comResumo)}</b><span>resumos</span></div>
          <div><b style={{ color: "#7CC4FF" }}>{fmtInt(comEmbedding)}</b><span>embeddings</span></div>
          <div><b style={{ color: "#F5A524" }}>{fmtInt(naFila)}</b><span>na fila</span></div>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#3BE0C9">Funil de enriquecimento</Eyebrow><h3>Estado da camada de IA</h3></div></div>
          {!kpis ? <ChartSkeleton height={230} /> : (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={cob} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                      {cob.map((d, i) => <Cell key={i} fill={d.cor} />)}
                    </Pie>
                    <Tooltip {...chartTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <div className="donut-big" style={{ color: "#3BE0C9" }}>{fmtInt(comTema)}</div>
                  <div className="donut-label">com tema</div>
                </div>
              </div>
              <div className="legend">
                {cob.map((d) => <span key={d.name}><i style={{ background: d.cor }} />{d.name}: <b>{fmtInt(d.value)}</b></span>)}
              </div>
            </>
          )}
        </Panel>

        <Panel className="score-card">
          <div className="panel-head"><div><Eyebrow color="#E5B567">Métrica proposta</Eyebrow><h3>Score de relevância executiva</h3></div></div>
          <p className="caption" style={{ marginTop: 0 }}>
            Sinal simples calculado <b>sobre campos reais</b> (view <code>vw_proposicoes_score</code>) para priorizar o que merece atenção:
          </p>
          <div className="formula">
            <span>score</span> = <em style={{ color: "#7CC4FF" }}>peso_tipo</em>
            + <em style={{ color: "#FF5C6C" }}>peso_tema_crítico</em>
            + <em style={{ color: "#6FCF97" }}>peso_recência</em>
            + <em style={{ color: "#5C6E8C" }}>peso_votação</em>
          </div>
          <ul className="score-legend">
            <li><b>tipo</b> — PL/PEC/PLP/MPV = 3 · PDL/PLV = 2 · demais = 1</li>
            <li><b>crítico</b> — tema crítico = 3 · senão 1</li>
            <li><b>recência</b> — 2026 = 4 → ≤2021 = 0,5</li>
            <li><b>votação</b> — +2 quando há vínculo proposição↔votação (auto-ativa)</li>
          </ul>
        </Panel>
      </div>

      <Panel>
        <div className="panel-head">
          <div><Eyebrow color="#3BE0C9">Explorador</Eyebrow><h3>Proposições enriquecidas pela IA</h3></div>
          <span className="muted-tag">{itens.length} exibidas · {fmtInt(comResumo)} com resumo</span>
        </div>
        <div className="filters">
          <div className="search">
            <Search size={14} />
            <input placeholder="Buscar na ementa ou resumo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select value={tema} onChange={(e) => setTema(e.target.value)}>
            {temasOpt.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposOpt.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        {error ? <PanelError message={error.message} /> : (
          <div className="ia-cards">
            {itens.map((p) => (
              <a key={p.proposicao_id} className="ia-card" href={linkCamara(p.proposicao_id)} target="_blank" rel="noreferrer">
                <div className="ia-card-head">
                  <span className="tema-chip" style={{ background: corTema(p.tema) + "22", color: corTema(p.tema), borderColor: corTema(p.tema) + "55" }}>
                    {p.tema ?? "Sem tema"}{p.critico && " ●"}
                  </span>
                  <span className="ia-meta">{p.tipo} · {fmtDataBR(p.data_apresentacao)}</span>
                  <span className="score-pill" title="score de relevância">{p.score.toFixed(1)}</span>
                </div>
                <div className="ia-ementa">{p.ementa}</div>
                <div className="ia-resumo"><Sparkles size={11} /> {p.resumo_executivo}</div>
              </a>
            ))}
            {itens.length === 0 && !isLoading && <div className="empty">Nenhuma proposição enriquecida bate com os filtros. Ajuste a busca para ver os resumos da IA.</div>}
            {itens.length === 0 && isLoading && <div className="empty">Carregando resumos da IA…</div>}
          </div>
        )}
      </Panel>
    </div>
  );
}
