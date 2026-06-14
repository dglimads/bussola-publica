"use client";
import { Fragment, useEffect, useState } from "react";
import useSWR, { SWRConfig } from "swr";
import {
  Compass, Radar as RadarIcon, Activity, Vote, Sparkles, Siren, ShieldAlert,
  AlertTriangle, Network, BookOpen, CheckCircle2, Users,
} from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Note } from "@/components/ui/Note";
import { RadarSignature, type RadarTema } from "@/components/ui/RadarSignature";
import { VisaoGeral } from "@/components/sections/VisaoGeral";
import { RadarTematico } from "@/components/sections/RadarTematico";
import { Atividade } from "@/components/sections/Atividade";
import { Votacoes } from "@/components/sections/Votacoes";
import { IALegislativa } from "@/components/sections/IALegislativa";
import { Alertas } from "@/components/sections/Alertas";
import { Arquitetura } from "@/components/sections/Arquitetura";
import { Sobre } from "@/components/sections/Sobre";
import { Entregaveis } from "@/components/sections/Entregaveis";
import { Equipe } from "@/components/sections/Equipe";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getKpis, getProposicoesPorTema } from "@/lib/queries";
import { corTema } from "@/lib/temas";
import { fmtInt, fmtMi, fmtUltimaCarga } from "@/lib/format";
import type { TabId } from "@/lib/nav";

const TABS = [
  { id: "geral", label: "Visão Geral", icon: Compass, Comp: VisaoGeral, meta: false },
  { id: "radar", label: "Radar Temático", icon: RadarIcon, Comp: RadarTematico, meta: false },
  { id: "atividade", label: "Atividade Parlamentar", icon: Activity, Comp: Atividade, meta: false },
  { id: "votacoes", label: "Votações", icon: Vote, Comp: Votacoes, meta: false },
  { id: "ia", label: "IA Legislativa", icon: Sparkles, Comp: IALegislativa, meta: false },
  { id: "alertas", label: "Alertas", icon: Siren, Comp: Alertas, meta: false },
  { id: "arquitetura", label: "Arquitetura", icon: Network, Comp: Arquitetura, meta: true },
  { id: "sobre", label: "Sobre", icon: BookOpen, Comp: Sobre, meta: true },
  { id: "entregaveis", label: "Entregáveis", icon: CheckCircle2, Comp: Entregaveis, meta: true },
  { id: "equipe", label: "Equipe", icon: Users, Comp: Equipe, meta: true },
] as const;

export default function Dashboard() {
  return (
    <SWRConfig value={{ refreshInterval: 60000, revalidateOnFocus: true, dedupingInterval: 5000, keepPreviousData: true }}>
      <Shell />
    </SWRConfig>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabId>("geral");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
  }, []);

  // navegacao entre abas disparada por outros componentes (Entregaveis -> Arquitetura)
  useEffect(() => {
    const onNav = (e: Event) => {
      const id = (e as CustomEvent<TabId>).detail;
      if (id) {
        setTab(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("bl-nav", onNav as EventListener);
    return () => window.removeEventListener("bl-nav", onNav as EventListener);
  }, []);

  useRealtimeRefresh();

  const { data: kpis } = useSWR("kpis", getKpis);
  const { data: temas } = useSWR("prop_tema", getProposicoesPorTema);

  const radarTemas: RadarTema[] = (temas ?? []).map((t) => ({
    id: t.tema_id, nome: t.tema, qtd: t.qtd, critico: t.critico, cor: corTema(t.tema),
  }));

  const goTab = (id: TabId) => {
    setTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const Active = TABS.find((t) => t.id === tab)!.Comp;

  return (
    <div className="bl-root">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Compass size={20} strokeWidth={2.2} /></span>
          <div className="brand-text">
            <div className="brand-name">Bússola Legislativa</div>
            <div className="brand-sub">Radar Legislativo Inteligente</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="live"><i /> Última varredura {kpis ? fmtUltimaCarga(kpis.ultima_carga) : "carregando…"}</span>
          <span className="src">Supabase · 8 tabelas · API Câmara dos Deputados · tempo real</span>
        </div>
      </header>

      {!hasSupabaseEnv && (
        <div className="env-banner">
          <Note tone="amber" icon={AlertTriangle}>
            <b>Configuração pendente:</b> crie <code>dashboard/.env.local</code> a partir de <code>.env.local.example</code> e preencha
            {" "}<code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (anon/publishable key, somente leitura). Sem isso as seções de dados não carregam.
          </Note>
        </div>
      )}

      {tab === "geral" && (
        <section className="hero">
          <div className="hero-copy">
            <Eyebrow color="#3BE0C9">Inteligência legislativa automatizada</Eyebrow>
            <h1>O oceano de dados da Câmara,<br />destilado em <span className="grad">sinal acionável</span>.</h1>
            <p>
              Captura, organiza e enriquece com IA o fluxo diário de proposições, votações e despesas dos
              deputados — pipeline Python/Pandas → Supabase/PostgreSQL → OpenAI → n8n.
            </p>
            <div className="hero-pills">
              <span><b>{kpis ? fmtInt(kpis.proposicoes) : "…"}</b> proposições</span>
              <span><b>{kpis ? fmtInt(kpis.deputados) : "…"}</b> deputados</span>
              <span><b>{kpis ? fmtMi(kpis.despesas_total) : "…"}</b> em despesas</span>
              <span className="cyan"><b>{kpis ? fmtInt(kpis.com_resumo) : "…"}</b> enriquecidas por IA</span>
            </div>
          </div>
          <div className="hero-radar">
            <RadarSignature temas={radarTemas} reduced={reduced} />
            <span className="hero-radar-cap">Radar de temas · críticos em destaque</span>
          </div>
        </section>
      )}

      <nav className="tabs">
        {TABS.map((t, i) => {
          const firstMeta = t.meta && !TABS[i - 1]?.meta;
          return (
            <Fragment key={t.id}>
              {firstMeta && <span className="tab-sep" aria-hidden />}
              <button className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => goTab(t.id)}>
                <t.icon size={15} strokeWidth={2} /> {t.label}
              </button>
            </Fragment>
          );
        })}
      </nav>

      <main className="content"><Active /></main>

      <footer className="foot">
        <div className="foot-intro">
          Este painel consolida dados capturados da <b>API de Dados Abertos da Câmara dos Deputados</b>,
          tratados pelo pipeline <b>Python/Pandas</b>, carregados no <b>Supabase/PostgreSQL</b> e enriquecidos com
          <b> IA</b> para classificação temática e geração de insights executivos.
        </div>
        <div className="foot-note">
          <ShieldAlert size={13} /> Leitura ao vivo via Supabase (anon key, RLS de leitura pública restrita a views) — números refletem o estado atual do banco, atualizados a cada 60s.
        </div>
      </footer>
    </div>
  );
}
