"use client";
import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip,
} from "recharts";
import { Siren, AlertTriangle, Sparkles, Filter } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { KpiCard } from "@/components/ui/KpiCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { ChartSkeleton, PanelError, Skeleton } from "@/components/ui/Skeleton";
import { chartTooltip } from "@/components/ui/chartTheme";
import { corTema } from "@/lib/temas";
import { fmtInt, pct } from "@/lib/format";
import { getKpis, getProposicoesPorTema } from "@/lib/queries";

export function RadarTematico() {
  const [soCriticos, setSoCriticos] = useState(false);
  const { data: kpis } = useSWR("kpis", getKpis);
  const { data: temas, error } = useSWR("prop_tema", getProposicoesPorTema);

  const lista = temas ?? [];
  const dados = soCriticos ? lista.filter((t) => t.critico) : lista;
  const maxQtd = Math.max(1, ...lista.map((t) => t.qtd));
  const radarData = lista.map((t) => ({ tema: t.tema.split(" ")[0], qtd: t.qtd }));
  const criticasTotal = lista.filter((t) => t.critico).reduce((s, t) => s + t.qtd, 0);
  const dominante = lista[0];
  const criticoLider = lista.filter((t) => t.critico)[0];
  const comTema = kpis?.com_tema ?? 0;
  const semClass = kpis ? Math.max(0, kpis.proposicoes - kpis.com_tema) : 0;
  const v = (node: React.ReactNode, ready: boolean) => (ready ? node : <Skeleton w={90} h={22} />);

  return (
    <div className="stack">
      <div className="kpi-grid four">
        <KpiCard label="Tema dominante" value={v(dominante?.tema ?? "—", !!temas)} sub={dominante ? `${fmtInt(dominante.qtd)} proposições` : "—"} accent={dominante ? corTema(dominante.tema) : "#9AA7C7"} />
        <KpiCard label="Temas críticos" value={v(fmtInt(criticasTotal), !!temas)} sub={temas ? `${pct(criticasTotal, comTema || 1)} das classificadas` : "—"} accent="#FF5C6C" icon={Siren} />
        <KpiCard label="Tema crítico líder" value={v(criticoLider?.tema ?? "—", !!temas)} sub={criticoLider ? `${fmtInt(criticoLider.qtd)} proposições` : "—"} accent="#E5B567" />
        <KpiCard label="Sem classificação" value={v(fmtInt(semClass), !!kpis)} sub="pendência de enriquecimento" accent="#F5A524" icon={AlertTriangle} />
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#E5B567">Pauta</Eyebrow><h3>Ranking de temas</h3></div>
            <button className={`toggle ${soCriticos ? "on" : ""}`} onClick={() => setSoCriticos((x) => !x)}>
              <Filter size={12} /> {soCriticos ? "Só críticos" : "Todos"}
            </button>
          </div>
          {error ? <PanelError message={error.message} /> : !temas ? <ChartSkeleton height={300} /> : (
            <div className="rank">
              {dados.map((t) => (
                <div key={t.tema_id} className="rank-row">
                  <div className="rank-name">
                    <span className="dot" style={{ background: corTema(t.tema) }} />
                    {t.tema}{t.critico && <span className="crit-tag">crítico</span>}
                  </div>
                  <div className="rank-bar-wrap">
                    <div className="rank-bar" style={{ width: `${(t.qtd / maxQtd) * 100}%`, background: corTema(t.tema) }} />
                  </div>
                  <span className="rank-val">{fmtInt(t.qtd)}</span>
                </div>
              ))}
              {dados.length === 0 && <div className="empty">Nenhum tema neste filtro.</div>}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="panel-head"><div><Eyebrow color="#3BE0C9">Distribuição</Eyebrow><h3>Radar temático</h3></div></div>
          {error ? <PanelError message={error.message} /> : !temas ? <ChartSkeleton height={300} /> : (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius={110}>
                <PolarGrid stroke="rgba(148,163,184,.18)" />
                <PolarAngleAxis dataKey="tema" tick={{ fontSize: 10, fill: "#93A4C0" }} />
                <Radar dataKey="qtd" stroke="#3BE0C9" fill="#3BE0C9" fillOpacity={0.28} strokeWidth={2} />
                <Tooltip {...chartTooltip} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Note tone="cyan" icon={Sparkles}>
        Heatmap <b>tema × partido</b> e <b>autor</b> dependem de <code>autor_id</code> na <code>fato_proposicoes</code>, hoje 100% nulo
        (relação proposição-autor é N:N e exige a ponte <code>ponte_proposicao_autores</code>). Mapeado como próximo passo do pipeline.
      </Note>
    </div>
  );
}
