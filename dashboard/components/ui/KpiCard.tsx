import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "./Panel";

export function KpiCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: LucideIcon;
}) {
  return (
    <Panel className="kpi">
      <div className="kpi-top">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon size={15} style={{ color: accent || "var(--dim)" }} strokeWidth={2} />}
      </div>
      <div className="kpi-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </Panel>
  );
}
