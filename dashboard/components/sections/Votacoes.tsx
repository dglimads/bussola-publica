"use client";
import useSWR from "swr";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Vote } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { KpiCard } from "@/components/ui/KpiCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { ChartSkeleton, PanelError, Skeleton } from "@/components/ui/Skeleton";
import { chartTooltip } from "@/components/ui/chartTheme";
import { fmtInt, pct, fmtDataBR, fmtDataCurta } from "@/lib/format";
import { getVotacoesResumo, getVotacoesPorOrgao, getVotacoesSerie } from "@/lib/queries";

export function Votacoes() {
  const { data: vot, error: errVot } = useSWR("votacoes_resumo", getVotacoesResumo);
  const { data: orgaos, error: errOrgao } = useSWR("votacoes_orgao", getVotacoesPorOrgao);
  const { data: serieRaw, error: errSerie } = useSWR("votacoes_serie", getVotacoesSerie);

  const v = (node: React.ReactNode) => (vot ? node : <Skeleton w={60} h={22} />);
  const aprov = vot
    ? [
        { name: "Aprovadas", value: vot.aprovadas, cor: "#6FCF97" },
        { name: "Reprovadas", value: vot.reprovadas, cor: "#FF5C6C" },
        { name: "Sem resultado", value: vot.sem_resultado, cor: "#5C6E8C" },
      ]
    : [];
  const serie = (serieRaw ?? []).map((d) => ({ dia: fmtDataCurta(d.dia), qtd: d.qtd }));

  return (
    <div className="stack">
      <div className="kpi-grid four">
        <KpiCard label="Votações" value={v(fmtInt(vot?.total ?? 0))} sub={vot ? `${fmtDataBR(vot.data_min)} – ${fmtDataBR(vot.data_max)}` : "—"} icon={Vote} />
        <KpiCard label="Aprovadas" value={v(fmtInt(vot?.aprovadas ?? 0))} sub={vot ? pct(vot.aprovadas, vot.total) : "—"} accent="#6FCF97" />
        <KpiCard label="Reprovadas" value={v(fmtInt(vot?.reprovadas ?? 0))} sub={vot ? pct(vot.reprovadas, vot.total) : "—"} accent="#FF5C6C" />
        <KpiCard label="Órgãos" value={v(fmtInt(vot?.orgaos ?? 0))} sub="comissões + plenário" />
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Onde se decide</Eyebrow><h3>Votações por órgão</h3></div></div>
          {errOrgao ? <PanelError message={errOrgao.message} /> : !orgaos ? <ChartSkeleton height={280} /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={orgaos.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 12, left: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="orgao" width={84} tick={{ fontSize: 10, fill: "#93A4C0" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="qtd" name="Votações" radius={[0, 3, 3, 0]} fill="#7CC4FF" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#6FCF97">Resultado</Eyebrow><h3>Aprovação</h3></div></div>
          {errVot ? <PanelError message={errVot.message} /> : !vot ? <ChartSkeleton height={280} /> : (
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={aprov} dataKey="value" innerRadius={66} outerRadius={98} paddingAngle={2} stroke="none">
                    {aprov.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip {...chartTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="donut-big" style={{ color: "#6FCF97" }}>{pct(vot.aprovadas, vot.total)}</div>
                <div className="donut-label">aprovadas</div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="panel-head"><div><Eyebrow color="#7CC4FF">Cronologia</Eyebrow><h3>Votações por data</h3></div></div>
        {errSerie ? <PanelError message={errSerie.message} /> : !serieRaw ? <ChartSkeleton height={200} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={serie} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6FCF97" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6FCF97" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...chartTooltip} />
              <Area type="monotone" dataKey="qtd" name="Votações" stroke="#6FCF97" strokeWidth={2} fill="url(#gv)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {vot && vot.com_proposicao === 0 ? (
        <Note tone="slate" icon={Vote}>
          Os eventos de votação ainda <b>não estão ligados às proposições</b> (<code>proposicao_id</code> nulo) nem há voto nominal por deputado —
          por isso “votações por partido / distribuição de votos” fica <b>preparado para evolução</b>. Disponíveis hoje: órgão, data e aprovação.
        </Note>
      ) : vot ? (
        <Note tone="cyan" icon={Vote}>
          <b>{fmtInt(vot.com_proposicao)}</b> votações já vinculadas a proposições (<code>proposicao_id</code>) — cruzamentos por tema e tipo habilitados.
        </Note>
      ) : null}
    </div>
  );
}
