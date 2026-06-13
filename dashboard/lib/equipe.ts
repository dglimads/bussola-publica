// Integrantes do grupo - Projeto Integrador Radar Legislativo (Xperiun).
export type Membro = {
  nome: string;
  email: string;
  telefone: string; // formato de exibicao; o href tel: e derivado dos digitos
};

export const EQUIPE: Membro[] = [
  { nome: "Giovanna Bastos de Jesus", email: "giovannabjesus@gmail.com", telefone: "11 98535-5831" },
  { nome: "Diego Lima Dos Santos", email: "dglimads@gmail.com", telefone: "+55 11 99860-7280" },
  { nome: "Thiago Santos Pedrazi", email: "thiagopedrazi@hotmail.com", telefone: "+55 21 97042-1228" },
  { nome: "Oscar Campos", email: "oscar.nac@hotmail.com", telefone: "11 98568-6289" },
  { nome: "Gabriel Dos Santos Nery Pereira", email: "santos.bielpereira@gmail.com", telefone: "11 98116-7197" },
  { nome: "Rômulo Oliveira Bittencourt", email: "bittencourt.ecn@gmail.com", telefone: "+55 61 91191669" },
];

// iniciais para o avatar (ex.: "Giovanna Bastos" -> "GB")
export const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /[A-ZÀ-Ý]/.test(p[0] ?? ""))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export const telHref = (t: string) => "tel:" + t.replace(/[^\d+]/g, "");
