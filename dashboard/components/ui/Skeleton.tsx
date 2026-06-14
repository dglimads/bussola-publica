import type { CSSProperties } from "react";

export function Skeleton({
  w,
  h = 16,
  style,
}: {
  w?: number | string;
  h?: number | string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="skel"
      style={{ display: "inline-block", width: w ?? "100%", height: h, borderRadius: 6, ...style }}
    />
  );
}

export function ChartSkeleton({ height = 230, label = "carregando…" }: { height?: number; label?: string }) {
  return (
    <div className="chart-skel skel" style={{ height }}>
      {label}
    </div>
  );
}

export function PanelError({ message }: { message?: string }) {
  return (
    <div className="panel-error">
      <b>falha ao carregar</b>
      <span>{message ?? "verifique o .env.local (anon key) e a conexao com o Supabase"}</span>
    </div>
  );
}
