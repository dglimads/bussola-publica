// Paleta de cores por tema - portada do bussola_legislativa.jsx.
// A correspondencia e por nome normalizado (sem acento, so letras), igual ao .jsx,
// para que a cor acompanhe o tema mesmo com variacoes de acentuacao vindas do banco.

const PALETA: Record<string, string> = {
  segurancapublica: "#9AA7C7",
  meioambiente: "#6FCF97",
  tributario: "#E5B567",
  saude: "#FF6B81",
  trabalho: "#7CC4FF",
  direitoshumanos: "#EB5BA0",
  infraestrutura: "#8B9DC3",
  educacao: "#F2994A",
  tecnologiaeia: "#3BE0C9",
  economia: "#C792EA",
};

// fallback deterministico para temas fora da paleta conhecida
const FALLBACK = [
  "#9AA7C7", "#6FCF97", "#E5B567", "#FF6B81", "#7CC4FF",
  "#EB5BA0", "#8B9DC3", "#F2994A", "#3BE0C9", "#C792EA",
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

export const corTema = (nome: string | null | undefined): string => {
  if (!nome) return "#9AA7C7";
  const key = norm(nome);
  if (PALETA[key]) return PALETA[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
};
