// Formatadores - portados 1:1 do bussola_legislativa.jsx, com coercao defensiva
// porque o PostgREST pode devolver numeric/bigint como string.

export const num = (n: number | string | null | undefined): number => {
  if (n === null || n === undefined) return 0;
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
};

export const fmtInt = (n: number | string) => num(n).toLocaleString("pt-BR");

export const fmtBRL = (n: number | string) =>
  num(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const fmtMi = (n: number | string) =>
  "R$ " + (num(n) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";

export const pct = (a: number | string, b: number | string) => {
  const A = num(a);
  const B = num(b);
  return B === 0 ? "0%" : ((A / B) * 100).toFixed(1) + "%";
};

export const linkCamara = (id: number | string) =>
  `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

// "2026-06-12" -> "12/06/2026"
export const fmtDataBR = (iso?: string | null) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

// "2026-06-12" -> "12/06" (eixo de series)
export const fmtDataCurta = (iso?: string | null) => {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
};

// timestamptz -> "13/06/2026 · 01:53 UTC"
export const fmtUltimaCarga = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} · ${hh}:${mi} UTC`;
};

// timestamptz -> "01:53" (UTC)
export const fmtHoraUTC = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

const MESES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const fmtMesAno = (ano: number, mes: number) => `${MESES[mes] ?? mes}/${String(ano).slice(2)}`;
