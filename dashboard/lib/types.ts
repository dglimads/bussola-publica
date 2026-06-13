// Tipos das views/RPC do dashboard (schema public do Supabase yipwbjexekvrqgnpvjfn).

export type Kpis = {
  proposicoes: number;
  com_tema: number;
  com_resumo: number;
  com_embedding: number;
  com_autor: number;
  deputados: number;
  ufs: number;
  partidos: number;
  temas: number;
  votacoes: number;
  despesas_docs: number;
  despesas_total: number;
  data_min: string | null;
  data_max: string | null;
  ultima_carga: string | null;
};

export type ProposicaoPorTipo = { tipo: string; qtd: number };
export type ProposicaoPorTema = { tema_id: number; tema: string; critico: boolean; qtd: number };
export type SerieDia = { dia: string; qtd: number };
export type SerieSemana = { semana: string; qtd: number };
export type ProposicaoPorAno = { ano: number; qtd: number };

export type DeputadoPorPartido = { partido_id: number; sigla: string; nome: string; deputados: number };
export type DeputadoPorUf = { uf: string; deputados: number };
export type PartidoAutor = { sigla: string | null; qtd: number };
export type TopDeputadoAutoria = {
  deputado_id: number; nome: string; partido: string | null; uf: string; proposicoes: number;
};

export type DespesaPorPartido = { sigla: string | null; total: number; docs: number };
export type DespesaPorCategoria = { categoria: string; total: number; docs: number };
export type TopDeputadoDespesa = {
  deputado_id: number; nome: string; partido: string | null; uf: string; total: number; docs: number;
};
export type DespesaSerieMensal = { ano: number; mes: number; total: number; docs: number };
export type TopFornecedor = {
  fornecedor_nome: string; fornecedor_cnpj: string | null; total: number; docs: number;
};

export type VotacoesResumo = {
  total: number; aprovadas: number; reprovadas: number; sem_resultado: number;
  orgaos: number; com_proposicao: number; data_min: string | null; data_max: string | null;
};
export type VotacaoPorOrgao = { orgao: string; qtd: number; aprovadas: number };
export type VotacaoSerie = { dia: string; qtd: number };

export type CriticaRecente = {
  proposicao_id: number; tipo: string; data_apresentacao: string; tema: string; ementa: string;
};

export type DataQualityRow = { metrica: string; valor: number; total: number };
export type DataQualityMap = Record<string, { valor: number; total: number }>;

export type ProposicaoEnriquecida = {
  proposicao_id: number; tipo: string; data_apresentacao: string;
  tema: string | null; critico: boolean; ementa: string; resumo_executivo: string; score: number;
};

export type EnriquecidasFiltro = {
  tema?: string | null; tipo?: string | null; busca?: string | null; limit?: number;
};
