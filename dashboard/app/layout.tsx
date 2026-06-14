import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bússola Legislativa · Radar Legislativo Inteligente",
  description:
    "Dashboard em tempo real do pipeline Bússola Pública — dados da Câmara dos Deputados (Supabase) enriquecidos com IA.",
};

export const viewport: Viewport = {
  themeColor: "#0A0F1C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
