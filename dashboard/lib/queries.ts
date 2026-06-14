// Uma funcao por view + a RPC. Toda a agregacao roda no Postgres (views);
// aqui so consumimos via PostgREST e fazemos coercao numerica defensiva.
import { supabase } from "./supabaseClient";
import { num } from "./format";
import type {
  Kpis, ProposicaoPorTipo, ProposicaoPorTema, SerieDia, SerieSemana, ProposicaoPorAno,
  DeputadoPorPartido, DeputadoPorUf, PartidoAutor, TopDeputadoAutoria, ProposicaoPorDeputado,
  HeatmapCell, DespesaPorPartido, DespesaPorCategoria, TopDeputadoDespesa, DespesaSerieMensal,
  TopFornecedor, VotacoesResumo, VotacaoPorOrgao, VotacaoSerie, VotoPorPartido, CriticaRecente,
  DataQualityRow, DataQualityMap, ProposicaoEnriquecida, EnriquecidasFiltro,
} from "./types";

type Order = { column: string; ascending?: boolean };

async function fetchRows(view: string, order?: Order): Promise<Record<string, unknown>[]> {
  let q = supabase.from(view).select("*");
  if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
  const { data, error } = await q;
  if (error) throw new Error(`${view}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

// coage as chaves numericas informadas (PostgREST pode devolver string)
function coerce<T>(rows: Record<string, unknown>[], numKeys: string[]): T[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const k of numKeys) o[k] = num(o[k] as number | string);
    return o as T;
  });
}

/* ---------------- KPIs ---------------- */
export async function getKpis(): Promise<Kpis> {
  const { data, error } = await supabase.from("vw_kpis").select("*").single();
  if (error) throw new Error(`vw_kpis: ${error.message}`);
  const d = data as Record<string, unknown>;
  return {
    proposicoes: num(d.proposicoes as number),
    com_tema: num(d.com_tema as number),
    com_resumo: num(d.com_resumo as number),
    com_embedding: num(d.com_embedding as number),
    com_autor: num(d.com_autor as number),
    deputados: num(d.deputados as number),
    ufs: num(d.ufs as number),
    partidos: num(d.partidos as number),
    temas: num(d.temas as number),
    votacoes: num(d.votacoes as number),
    votacoes_com_votos: num(d.votacoes_com_votos as number),
    votos_nominais: num(d.votos_nominais as number),
    despesas_docs: num(d.despesas_docs as number),
    despesas_total: num(d.despesas_total as number),
    data_min: (d.data_min as string) ?? null,
    data_max: (d.data_max as string) ?? null,
    ultima_carga: (d.ultima_carga as string) ?? null,
  };
}

/* ---------------- Proposicoes ---------------- */
export const getProposicoesPorTipo = async () =>
  coerce<ProposicaoPorTipo>(await fetchRows("vw_proposicoes_por_tipo", { column: "qtd" }), ["qtd"]);

export const getProposicoesPorTema = async () =>
  coerce<ProposicaoPorTema>(await fetchRows("vw_proposicoes_por_tema", { column: "qtd" }), ["tema_id", "qtd"]);

export const getProposicoesSerieDiaria = async () =>
  coerce<SerieDia>(await fetchRows("vw_proposicoes_serie_diaria", { column: "dia", ascending: true }), ["qtd"]);

export const getProposicoesSerieSemanal = async () =>
  coerce<SerieSemana>(await fetchRows("vw_proposicoes_serie_semanal", { column: "semana", ascending: true }), ["qtd"]);

export const getProposicoesPorAno = async () =>
  coerce<ProposicaoPorAno>(await fetchRows("vw_proposicoes_por_ano", { column: "ano", ascending: true }), ["ano", "qtd"]);

/* ---------------- Deputados / Partidos ---------------- */
export const getDeputadosPorPartido = async () =>
  coerce<DeputadoPorPartido>(await fetchRows("vw_deputados_por_partido", { column: "deputados" }), ["partido_id", "deputados"]);

export const getDeputadosPorUf = async () =>
  coerce<DeputadoPorUf>(await fetchRows("vw_deputados_por_uf", { column: "deputados" }), ["deputados"]);

export const getProposicoesPorPartidoAutor = async () =>
  coerce<PartidoAutor>(await fetchRows("vw_proposicoes_por_partido_autor", { column: "qtd" }), ["qtd"]);

export const getTopDeputadosAutoria = async () =>
  coerce<TopDeputadoAutoria>(await fetchRows("vw_top_deputados_autoria", { column: "proposicoes" }), ["deputado_id", "proposicoes"]);

export const getProposicoesPorDeputado = async () =>
  coerce<ProposicaoPorDeputado>(
    await fetchRows("vw_proposicoes_por_deputado", { column: "qtd_proposicoes" }),
    ["deputado_id", "qtd_proposicoes", "qtd_temas", "qtd_como_proponente"],
  );

// Heatmap tema x partido (autoria real via ponte). Ordena por volume; a matriz
// e montada no componente a partir das celulas (sigla x tema).
export const getHeatmapTemaPartido = async () =>
  coerce<HeatmapCell>(
    await fetchRows("vw_heatmap_tema_partido", { column: "qtd_proposicoes" }),
    ["tema_id", "qtd_proposicoes", "qtd_deputados_autores"],
  );

/* ---------------- Despesas (CEAP) ---------------- */
export const getDespesasPorPartido = async () =>
  coerce<DespesaPorPartido>(await fetchRows("vw_despesas_por_partido", { column: "total" }), ["total", "docs"]);

export const getDespesasPorCategoria = async () =>
  coerce<DespesaPorCategoria>(await fetchRows("vw_despesas_por_categoria", { column: "total" }), ["total", "docs"]);

export const getTopDeputadosDespesa = async () =>
  coerce<TopDeputadoDespesa>(await fetchRows("vw_top_deputados_despesa", { column: "total" }), ["deputado_id", "total", "docs"]);

export const getDespesasSerieMensal = async () =>
  coerce<DespesaSerieMensal>(await fetchRows("vw_despesas_serie_mensal", { column: "ano", ascending: true }), ["ano", "mes", "total", "docs"]);

export const getTopFornecedores = async () =>
  coerce<TopFornecedor>(await fetchRows("vw_top_fornecedores", { column: "total" }), ["total", "docs"]);

/* ---------------- Votacoes ---------------- */
export async function getVotacoesResumo(): Promise<VotacoesResumo> {
  const { data, error } = await supabase.from("vw_votacoes_resumo").select("*").single();
  if (error) throw new Error(`vw_votacoes_resumo: ${error.message}`);
  const d = data as Record<string, unknown>;
  return {
    total: num(d.total as number),
    aprovadas: num(d.aprovadas as number),
    reprovadas: num(d.reprovadas as number),
    sem_resultado: num(d.sem_resultado as number),
    orgaos: num(d.orgaos as number),
    com_proposicao: num(d.com_proposicao as number),
    com_votos: num(d.com_votos as number),
    votos_nominais: num(d.votos_nominais as number),
    data_min: (d.data_min as string) ?? null,
    data_max: (d.data_max as string) ?? null,
  };
}

export const getVotacoesPorOrgao = async () =>
  coerce<VotacaoPorOrgao>(await fetchRows("vw_votacoes_por_orgao", { column: "qtd" }), ["qtd", "aprovadas"]);

export const getVotacoesSerie = async () =>
  coerce<VotacaoSerie>(await fetchRows("vw_votacoes_serie", { column: "dia", ascending: true }), ["qtd"]);

export const getVotosPorPartido = async () =>
  coerce<VotoPorPartido>(
    await fetchRows("vw_votos_por_partido", { column: "qtd_votos" }),
    ["qtd_votos", "sim", "nao", "qtd_deputados"],
  );

/* ---------------- Alertas ---------------- */
export const getCriticasRecentes = async () =>
  coerce<CriticaRecente>(await fetchRows("vw_criticas_classificadas_recentes"), ["proposicao_id"]);

/* ---------------- Qualidade ---------------- */
export async function getDataQuality(): Promise<DataQualityMap> {
  const rows = coerce<DataQualityRow>(await fetchRows("vw_data_quality"), ["valor", "total"]);
  const map: DataQualityMap = {};
  for (const r of rows) map[r.metrica] = { valor: r.valor, total: r.total };
  return map;
}

/* ---------------- RPC: explorador filtravel ---------------- */
export async function getProposicoesEnriquecidas(f: EnriquecidasFiltro = {}): Promise<ProposicaoEnriquecida[]> {
  const { data, error } = await supabase.rpc("fn_proposicoes_enriquecidas", {
    p_tema: f.tema && f.tema !== "Todos" ? f.tema : null,
    p_tipo: f.tipo && f.tipo !== "Todos" ? f.tipo : null,
    p_busca: f.busca && f.busca.trim() ? f.busca.trim() : null,
    p_limit: f.limit ?? 80,
  });
  if (error) throw new Error(`fn_proposicoes_enriquecidas: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    proposicao_id: num(r.proposicao_id as number),
    tipo: r.tipo as string,
    data_apresentacao: r.data_apresentacao as string,
    tema: (r.tema as string) ?? null,
    critico: Boolean(r.critico),
    ementa: r.ementa as string,
    resumo_executivo: r.resumo_executivo as string,
    score: num(r.score as number),
  }));
}
