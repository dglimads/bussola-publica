"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";

// Moldura de screenshot com fallback: se o arquivo nao existir em public/prints/,
// mostra um placeholder com o nome esperado em vez de uma imagem quebrada.
export function PrintFrame({ src, titulo, hint }: { src: string; titulo: string; hint?: string }) {
  const [erro, setErro] = useState(false);
  return (
    <figure className="print-frame">
      {erro ? (
        <div className="print-ph">
          <ImageOff size={22} strokeWidth={1.8} />
          <code>{src}</code>
          {hint && <span className="print-hint">{hint}</span>}
        </div>
      ) : (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={titulo} loading="lazy" onError={() => setErro(true)} />
        </a>
      )}
      <figcaption className="print-cap">{titulo}</figcaption>
    </figure>
  );
}
