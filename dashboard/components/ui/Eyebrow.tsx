import type { ReactNode } from "react";

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="eyebrow" style={color ? { color } : undefined}>
      {children}
    </span>
  );
}
