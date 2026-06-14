// Assinatura do radar - SVG portado 1:1 do bussola_legislativa.jsx,
// agora alimentado por dados vivos (vw_proposicoes_por_tema) em vez da constante.
export type RadarTema = {
  id: number | string;
  nome: string;
  qtd: number;
  critico: boolean;
  cor: string;
};

export function RadarSignature({ temas, reduced }: { temas: RadarTema[]; reduced?: boolean }) {
  const top = temas.slice(0, 8);
  const max = Math.max(1, ...top.map((t) => t.qtd));
  const cx = 130,
    cy = 130,
    R = 112;
  return (
    <svg viewBox="0 0 260 260" className="radar-sig" aria-hidden="true">
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#16314a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0a0f1c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3BE0C9" stopOpacity="0" />
          <stop offset="100%" stopColor="#3BE0C9" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#rg)" />
      {[0.33, 0.66, 1].map((f, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={R * f}
          fill="none"
          stroke="rgba(148,163,184,.16)"
          strokeWidth="1"
        />
      ))}
      {top.map((_, i) => {
        const a = (Math.PI * 2 * i) / top.length - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + R * Math.cos(a)}
            y2={cy + R * Math.sin(a)}
            stroke="rgba(148,163,184,.10)"
            strokeWidth="1"
          />
        );
      })}
      {!reduced && (
        <g className="sweep-rot" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path
            d={`M${cx} ${cy} L${cx + R} ${cy} A${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.5)} ${cy + R * Math.sin(-0.5)} Z`}
            fill="url(#sweep)"
          />
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="#3BE0C9" strokeWidth="1.5" />
        </g>
      )}
      {top.map((t, i) => {
        const a = (Math.PI * 2 * i) / top.length - Math.PI / 2;
        const r = 22 + (R - 28) * (t.qtd / max);
        const x = cx + r * Math.cos(a),
          y = cy + r * Math.sin(a);
        return (
          <g key={t.id}>
            <circle
              cx={x}
              cy={y}
              r={t.critico ? 5.5 : 4}
              fill={t.cor}
              stroke={t.critico ? "#FF5C6C" : "none"}
              strokeWidth={t.critico ? 1.5 : 0}
            />
            {t.critico && (
              <circle cx={x} cy={y} r="9" fill="none" stroke={t.cor} strokeOpacity="0.4" strokeWidth="1" />
            )}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="3.5" fill="#E5B567" />
    </svg>
  );
}
