import type { ReactNode } from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";

export function Note({
  children,
  icon: Icon = AlertTriangle,
  tone = "amber",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: "amber" | "cyan" | "slate";
}) {
  return (
    <div className={`note note-${tone}`}>
      <Icon size={14} strokeWidth={2.2} />
      <span>{children}</span>
    </div>
  );
}
