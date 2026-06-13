"use client";
import useSWR from "swr";
import { Siren, ShieldAlert, ArrowUpRight } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ChartSkeleton, PanelError, Skeleton } from "@/components/ui/Skeleton";
import { corTema } from "@/lib/temas";
import { fmtInt, fmtDataBR, linkCamara } from "@/lib/format";
import { getKpis, getProposicoesPorTema, getCriticasRecentes } from "@/lib/queries";

export function Alertas() {
  const { data: kpis } = useSWR("kpis", getKpis);
  const { data: temas, error: errTemas } = useSWR("prop_tema", getProposicoesPorTema);
  const { data: criticas, error: errCrit } = useSWR("criticas_recentes", getCriticasRecentes);

  const semTema = kpis ? Math.max(0, kpis.proposicoes - kpis.com_tema) : 0;
  const semResumo = kpis ? Math.max(0, kpis.proposicoes - kpis.com_resumo) : 0;
  const criticos = (temas ?? []).filter((t) => t.critico);

  return (
    <div className="stack">
      <Panel className="alert-hero">
        <div className="alert-hero-icon"><Siren size={22} /></div>
        <div>
          <Eyebrow color="#F5A524">Alerta de pipeline · prioridade alta</Eyebrow>
          <h3 style={{ margin: "4px 0 6px" }}>
            {kpis ? `${fmtInt(semTema)} proposições aguardam classificação de IA` : <Skeleton w={320} h={20} />}
          </h3>
          <p className="caption" style={{ margin: 0 }}>
            {kpis ? (
              <>
                O enriquecimento cobre um lote inicial do acervo. Hoje <b>{fmtInt(semTema)}</b> proposições estão <b>sem tema</b> e <b>{fmtInt(semResumo)}</b> <b>sem resumo</b>
                {" "}(a base vai até {fmtDataBR(kpis.data_max)}). Rodar <code>run_ai_enrichment.py</code> no backlog recente fecha a lacuna e ativa os alertas de tema crítico em tempo real.
              </>
            ) : "Calculando pendências do enriquecimento…"}
          </p>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel>
          <div className="panel-head"><div><Eyebrow color="#FF5C6C">Temas críticos na base</Eyebrow><h3>Sinais que disparam alerta</h3></div></div>
          {errTemas ? <PanelError message={errTemas.message} /> : !temas ? <ChartSkeleton height={200} /> : (
            <div className="crit-grid">
              {criticos.map((t) => (
                <div key={t.tema_id} className="crit-cell" style={{ borderColor: corTema(t.tema) + "44" }}>
                  <span className="dot" style={{ background: corTema(t.tema) }} />
                  <div className="crit-cell-body">
                    <span className="crit-cell-name">{t.tema}</span>
                    <span className="crit-cell-val">{fmtInt(t.qtd)} <em>proposições</em></span>
                  </div>
                </div>
              ))}
              {criticos.length === 0 && <div className="empty">Nenhum tema marcado como crítico em <code>dim_temas</code>.</div>}
            </div>
          )}
          <p className="caption">
            Temas marcados <code>critico = true</code> em <code>dim_temas</code> alimentam o nó de alerta do n8n (e-mail/Telegram) a cada varredura.
          </p>
        </Panel>

        <Panel>
          <div className="panel-head"><div><Eyebrow>Monitoramento</Eyebrow><h3>Últimas críticas classificadas</h3></div></div>
          {errCrit ? <PanelError message={errCrit.message} /> : !criticas ? <ChartSkeleton height={200} /> : (
            <div className="mon-list">
              {criticas.map((p) => (
                <a key={p.proposicao_id} className="mon-row" href={linkCamara(p.proposicao_id)} target="_blank" rel="noreferrer">
                  <span className="tema-chip sm" style={{ background: corTema(p.tema) + "22", color: corTema(p.tema), borderColor: corTema(p.tema) + "55" }}>{p.tema}</span>
                  <div className="mon-body">
                    <span className="mon-ementa">{p.ementa}</span>
                    <span className="mon-meta">{p.tipo} {p.proposicao_id} · {fmtDataBR(p.data_apresentacao)}</span>
                  </div>
                  <ArrowUpRight size={14} className="mon-arrow" />
                </a>
              ))}
              {criticas.length === 0 && <div className="empty">Sem proposições críticas classificadas ainda — rode o enriquecimento de IA.</div>}
            </div>
          )}
        </Panel>
      </div>

      <div className="foot-note" style={{ marginTop: 4 }}>
        <ShieldAlert size={13} /> Alertas calculados em tempo real a partir de <code>vw_data_quality</code>, <code>vw_proposicoes_por_tema</code> e <code>vw_criticas_classificadas_recentes</code>.
      </div>
    </div>
  );
}
