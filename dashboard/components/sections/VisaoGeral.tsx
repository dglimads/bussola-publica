"use client";
import useSWR from "swr";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie,
} from "recharts";
import { Compass, Activity, Vote, Sparkles, Database, ArrowUpRight, Radar as RadarIcon } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { KpiCard } from "@/components/ui/KpiCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Skeleton, ChartSkeleton, PanelError } from "@/components/ui/Skeleton";
import { chartTooltip } from "@/components/ui/chartTheme";
import { corTema } from "@/lib/temas";
import { fmtInt, fmtMi, pct, fmtDataCurta, fmtDataBR, fmtHoraUTC } from "@/lib/format";
import {
  getKpis, getVotacoesResumo, getProposicoesSerieDiaria, getProposicoesPorTipo, getProposicoesPorTema,
} from "@/lib/queries";

export function VisaoGeral() {
  const { data: kpis, error: errKpis } = useSWR("kpis", getKpis);
  const { data: vot } = useSWR("votacoes_resumo", getVotacoesResumo);
  const { data: serieRaw, error: errSerie } = useSWR("serie_diaria", getProposicoesSerieDiaria);
  const { data: tipos, error: errTipos } = useSWR("prop_tipo", getProposicoesPorTipo);
  const { data: temas, error: errTemas } = useSWR("prop_tema", getProposicoesPorTema);

  const v = (node: React.ReactNode) => (kpis ? node : <Skeleton w={74} h={22} />);

  // janela recente da serie diaria (a view cobre 2003+, mostramos os ultimos dias com atividade)
  const serie = (serieRaw ?? []).slice(-30).map((d) => ({ dia: fmtDataCurta(d.dia), qtd: d.qtd }));
  const pico = serie.reduce((acc, d) => (d.qtd > acc.qtd ? d : acc), { dia: "", qtd: 0 });

  const proposicoes = kpis?.proposicoes ?? 0;
  const comResumo = kpis?.com_resumo ?? 0;
  const coberturaIA = [
    { name: "Enriquecidas", value: comResumo, cor: "#3BE0C9" },
    { name: "Pendentes", value: Math.max(0, proposicoes - comResumo), cor: "#283449" },
  ];

  return (
    <div className="stack">
      <div className="kpi-grid">
        <KpiCard label="Proposições" value={v(fmtInt(proposicoes))} sub="monitoradas na base" icon={Database} accent="#EAF0FB" />
        <KpiCard label="Deputados" value={v(fmtInt(kpis?.deputados ?? 0))} sub={kpis ? `em exercício · ${kpis.ufs} UFs` : "—"} icon={Activity} />
        <KpiCard label="Partidos" value={v(fmtInt(kpis?.partidos ?? 0))} sub="legendas com bancada" icon={Compass} />
        <KpiCard label="Votações" value={v(fmtInt(kpis?.votacoes ?? 0))} sub={vot ? `${fmtDataCurta(vot.data_min)}–${fmtDataCurta(vot.data_max)} · ${vot.orgaos} órgãos` : "—"} icon={Vote} />
        <KpiCard label="Despesas (CEAP)" value={v(fmtMi(kpis?.despesas_total ?? 0))} sub={kpis ? `${fmtInt(kpis.despesas_docs)} documentos` : "—"} icon={ArrowUpRight} accent="#E5B567" />
        <KpiCard label="Classificadas por IA" value={v(fmtInt(kpis?.com_tema ?? 0))} sub={kpis ? `${pct(kpis.com_tema, kpis.proposicoes)} do acervo` : "—"} icon={Sparkles} accent="#3BE0C9" />
        <KpiCard label="Resumos executivos" value={v(fmtInt(comResumo))} sub={kpis ? `${pct(comResumo, kpis.proposicoes)} gerados` : "—"} icon={Sparkles} accent="#3BE0C9" />
        <KpiCard label="Última varredura" value={v(fmtHoraUTC(kpis?.ultima_carga))} sub={kpis ? `${fmtDataBR(kpis.ultima_carga)} (UTC)` : "—"} icon={RadarIcon} />
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#7CC4FF">Fluxo legislativo</Eyebrow><h3>Evolução diária de proposições</h3></div>
            <span className="muted-tag">últimos {serie.length} dias com atividade</span>
          </div>
          {errSerie ? <PanelError message={errSerie.message} /> : !serieRaw ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={serie} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7CC4FF" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#7CC4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#5C6E8C" }} interval={2} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Area type="monotone" dataKey="qtd" name="Proposições" stroke="#7CC4FF" strokeWidth={2} fill="url(#gd)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {pico.qtd > 0 && <p className="caption">Pico em <b>{pico.dia}</b> com <b>{fmtInt(pico.qtd)}</b> proposições — picos correspondem a cargas de backfill do pipeline.</p>}
        </Panel>

        <Panel>
          <div className="panel-head">
            <div><Eyebrow color="#3BE0C9">Maturidade da IA</Eyebrow><h3>Cobertura de enriquecimento</h3></div>
          </div>
          {errKpis ? <PanelError message={errKpis.message} /> : !kpis ? <ChartSkeleton /> : (
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={coberturaIA} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                    {coberturaIA.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip {...chartTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="donut-big">{pct(comResumo, proposicoes)}</div>
                <div className="donut-label">enriquecidas</div>
              </div>
            </div>
          )}
          {kpis && <p className="caption"><b style={{ color: "#3BE0C9" }}>{fmtInt(comResumo)}</b> com resumo + embedding · <b>{fmtInt(Math.max(0, proposicoes - comResumo))}</b> aguardando processamento.</p>}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow>Composição do acervo</Eyebrow><h3>Proposições por tipo</h3></div></div>
          {errTipos ? <PanelError message={errTipos.message} /> : !tipos ? <ChartSkeleton height={240} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tipos.slice(0, 12)} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" vertical={false} />
                <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="qtd" name="Qtd" radius={[3, 3, 0, 0]} fill="#7CC4FF" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#E5B567">Classificação por IA</Eyebrow><h3>Proposições por tema</h3></div></div>
          {errTemas ? <PanelError message={errTemas.message} /> : !temas ? <ChartSkeleton height={240} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={temas} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#5C6E8C" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="tema" width={108} tick={{ fontSize: 10, fill: "#93A4C0" }} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="qtd" name="Proposições" radius={[0, 3, 3, 0]}>
                  {temas.map((t, i) => <Cell key={i} fill={corTema(t.tema)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}
