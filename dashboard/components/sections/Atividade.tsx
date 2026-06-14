"use client";
import useSWR from "swr";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { ChartSkeleton, PanelError } from "@/components/ui/Skeleton";
import { chartTooltip } from "@/components/ui/chartTheme";
import { fmtInt, fmtBRL } from "@/lib/format";
import {
  getKpis, getDeputadosPorPartido, getDeputadosPorUf, getDespesasPorPartido,
  getTopDeputadosDespesa, getProposicoesPorPartidoAutor, getTopDeputadosAutoria,
} from "@/lib/queries";

export function Atividade() {
  const { data: kpis } = useSWR("kpis", getKpis);
  const { data: bancada, error: errBancada } = useSWR("dep_partido", getDeputadosPorPartido);
  const { data: ufs, error: errUf } = useSWR("dep_uf", getDeputadosPorUf);
  const { data: despPartido, error: errDP } = useSWR("desp_partido", getDespesasPorPartido);
  const { data: topDep, error: errTD } = useSWR("top_dep_desp", getTopDeputadosDespesa);

  const temAutor = (kpis?.com_autor ?? 0) > 0;
  // so busca autoria quando ja existe autor_id (evita queries vazias desnecessarias)
  const { data: partidoAutor } = useSWR(temAutor ? "prop_partido_autor" : null, getProposicoesPorPartidoAutor);
  const { data: topAutoria } = useSWR(temAutor ? "top_dep_autoria" : null, getTopDeputadosAutoria);

  return (
    <div className="stack">
      {!temAutor && (
        <Note tone="amber">
          A API não traz o autor diretamente em <code>/proposicoes</code> — a autoria vem da ponte N:N{" "}
          <code>ponte_proposicao_autores</code>, ainda não populada. Rode{" "}
          <code>python scripts/4_run_authors_bridge.py --only-missing</code> e <b>“proposições por deputado/partido”</b>{" "}
          aparece aqui. Por ora, esta seção usa os sinais <b>reais já carregados</b>: composição das bancadas e{" "}
          <b>cota parlamentar (CEAP)</b>, que liga deputado → partido.
        </Note>
      )}

      {temAutor && (
        <div className="grid-2">
          <Panel>
            <div className="panel-head"><div><Eyebrow color="#3BE0C9">Autoria</Eyebrow><h3>Proposições por partido (autor)</h3></div></div>
            {!partidoAutor ? <ChartSkeleton height={300} /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={partidoAutor.slice(0, 14)} margin={{ top: 4, right: 8, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
                  <XAxis dataKey="sigla" tick={{ fontSize: 9, fill: "#5C6E8C" }} angle={-45} textAnchor="end" height={40} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                  <Tooltip {...chartTooltip} />
                  <Bar dataKey="qtd" name="Proposições" radius={[3, 3, 0, 0]} fill="#3BE0C9" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
          <Panel>
            <div className="panel-head"><div><Eyebrow color="#3BE0C9">Autoria</Eyebrow><h3>Top deputados por autoria</h3></div></div>
            <div className="table">
              <div className="trow thead"><span>Deputado</span><span>Part.</span><span>UF</span><span className="ta-r">Proposições</span></div>
              {(topAutoria ?? []).slice(0, 10).map((d) => (
                <div key={d.deputado_id} className="trow">
                  <span className="td-strong">{d.nome}</span>
                  <span><span className="part-chip">{d.partido ?? "—"}</span></span>
                  <span className="td-dim">{d.uf}</span>
                  <span className="ta-r td-mono">{fmtInt(d.proposicoes)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Composição</Eyebrow><h3>Bancada por partido</h3></div><span className="muted-tag">{kpis ? `${fmtInt(kpis.deputados)} deputados` : "—"}</span></div>
          {errBancada ? <PanelError message={errBancada.message} /> : !bancada ? <ChartSkeleton height={300} /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bancada.slice(0, 14)} margin={{ top: 4, right: 8, left: -20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
                <XAxis dataKey="sigla" tick={{ fontSize: 9, fill: "#5C6E8C" }} angle={-45} textAnchor="end" height={40} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="deputados" name="Deputados" radius={[3, 3, 0, 0]} fill="#7CC4FF" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow>Distribuição federativa</Eyebrow><h3>Deputados por UF</h3></div></div>
          {errUf ? <PanelError message={errUf.message} /> : !ufs ? <ChartSkeleton height={300} /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ufs.slice(0, 16)} margin={{ top: 4, right: 8, left: -20, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
                <XAxis dataKey="uf" tick={{ fontSize: 9, fill: "#5C6E8C" }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="deputados" name="Deputados" radius={[3, 3, 0, 0]} fill="#6FCF97" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#E5B567">Cota parlamentar</Eyebrow><h3>Despesa líquida por partido</h3></div><span className="muted-tag">base carregada</span></div>
          {errDP ? <PanelError message={errDP.message} /> : !despPartido ? <ChartSkeleton height={300} /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={despPartido.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "#5C6E8C" }} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1e6).toFixed(0)}M`} />
                <YAxis type="category" dataKey="sigla" width={92} tick={{ fontSize: 10, fill: "#93A4C0" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} formatter={(val) => fmtBRL(val as number)} />
                <Bar dataKey="total" name="Despesa" radius={[0, 3, 3, 0]} fill="#E5B567" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="caption">Soma de <code>valor_liquido</code> da CEAP por partido na <b>base já carregada</b> — não representa a Câmara inteira.</p>
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#E5B567">Cota parlamentar</Eyebrow><h3>Top deputados por despesa</h3></div></div>
          {errTD ? <PanelError message={errTD.message} /> : !topDep ? <ChartSkeleton height={300} /> : (
            <div className="table">
              <div className="trow thead"><span>Deputado</span><span>Part.</span><span>UF</span><span className="ta-r">Despesa líq.</span></div>
              {topDep.slice(0, 10).map((d) => (
                <div key={d.deputado_id} className="trow">
                  <span className="td-strong">{d.nome}</span>
                  <span><span className="part-chip">{d.partido ?? "—"}</span></span>
                  <span className="td-dim">{d.uf}</span>
                  <span className="ta-r td-mono">{fmtBRL(d.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
