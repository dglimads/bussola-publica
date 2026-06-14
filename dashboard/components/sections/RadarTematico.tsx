"use client";
import { Fragment, useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip,
} from "recharts";
import { Siren, AlertTriangle, Sparkles, Filter, Grid3x3 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { KpiCard } from "@/components/ui/KpiCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { ChartSkeleton, PanelError, Skeleton } from "@/components/ui/Skeleton";
import { chartTooltip } from "@/components/ui/chartTheme";
import { corTema } from "@/lib/temas";
import { fmtInt, pct } from "@/lib/format";
import { getKpis, getProposicoesPorTema, getHeatmapTemaPartido } from "@/lib/queries";

// hex -> rgba com alpha (para a escala de intensidade do heatmap)
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function RadarTematico() {
  const [soCriticos, setSoCriticos] = useState(false);
  const { data: kpis } = useSWR("kpis", getKpis);
  const { data: temas, error } = useSWR("prop_tema", getProposicoesPorTema);

  const temAutor = (kpis?.com_autor ?? 0) > 0;
  // so busca o heatmap quando ja existe autoria carregada (evita query vazia)
  const { data: heat } = useSWR(temAutor ? "heatmap" : null, getHeatmapTemaPartido);

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

  // --- monta a matriz do heatmap (partido x tema) a partir das celulas ---
  const cells = heat ?? [];
  const temaTot = new Map<string, number>();
  const partTot = new Map<string, number>();
  const cellMap = new Map<string, number>();
  let maxCell = 1;
  for (const c of cells) {
    temaTot.set(c.tema, (temaTot.get(c.tema) ?? 0) + c.qtd_proposicoes);
    partTot.set(c.sigla_partido, (partTot.get(c.sigla_partido) ?? 0) + c.qtd_proposicoes);
    cellMap.set(`${c.sigla_partido}|${c.tema}`, c.qtd_proposicoes);
    if (c.qtd_proposicoes > maxCell) maxCell = c.qtd_proposicoes;
  }
  const temasCols = [...temaTot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  const partRows = [...partTot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p]) => p);

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

      {/* Heatmap tema x partido -- so aparece quando ha autoria carregada na ponte */}
      {temAutor ? (
        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#3BE0C9">Autoria real · ponte N:N</Eyebrow><h3>Heatmap tema × partido</h3></div>
            <span className="muted-tag"><Grid3x3 size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />proposições por autor</span>
          </div>
          {!heat ? <ChartSkeleton height={300} /> : cells.length === 0 ? (
            <div className="empty">Sem dados de autoria para cruzar tema × partido.</div>
          ) : (
            <>
              <div className="heat" style={{ gridTemplateColumns: `96px repeat(${temasCols.length}, 1fr)` }}>
                <div className="heat-corner" />
                {temasCols.map((t) => (
                  <div key={t} className="heat-head" style={{ color: corTema(t) }} title={t}>
                    {t.split(" ")[0]}
                  </div>
                ))}
                {partRows.map((p) => (
                  <Fragment key={p}>
                    <div className="heat-rowlabel"><span className="part-chip">{p}</span></div>
                    {temasCols.map((t) => {
                      const q = cellMap.get(`${p}|${t}`) ?? 0;
                      const intensidade = q / maxCell;
                      return (
                        <div
                          key={t}
                          className="heat-cell"
                          title={`${p} · ${t}: ${fmtInt(q)} proposições`}
                          style={{
                            background: q ? hexToRgba(corTema(t), 0.12 + 0.62 * intensidade) : "transparent",
                            color: intensidade > 0.5 ? "#0A0F1C" : "var(--dim)",
                          }}
                        >
                          {q || ""}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
              <p className="caption">
                Intensidade = nº de proposições cuja <b>autoria</b> (via <code>ponte_proposicao_autores</code>) liga
                o partido ao tema. Top {partRows.length} partidos × top {temasCols.length} temas por volume.
              </p>
            </>
          )}
        </Panel>
      ) : (
        <Note tone="cyan" icon={Sparkles}>
          Heatmap <b>tema × partido</b> e <b>autoria por deputado/partido</b> dependem da ponte{" "}
          <code>ponte_proposicao_autores</code> (relação proposição-autor é N:N). A migration e o bridge já estão
          prontos — rode <code>python scripts/4_run_authors_bridge.py --only-missing</code> para popular e este
          painel passa a exibir a matriz automaticamente.
        </Note>
      )}
    </div>
  );
}
