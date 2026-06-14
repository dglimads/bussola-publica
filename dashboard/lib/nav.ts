// Navegacao entre abas via CustomEvent (o Dashboard escuta "bl-nav").
export type TabId =
  | "geral" | "radar" | "atividade" | "votacoes" | "ia" | "alertas"
  | "arquitetura" | "sobre" | "entregaveis" | "equipe";

export const navTo = (id: TabId) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<TabId>("bl-nav", { detail: id }));
  }
};
