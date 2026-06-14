/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: `next build` gera a pasta `out/` 100% estatica.
  // Pode ser hospedada em QUALQUER lugar (Vercel, Netlify, GitHub Pages, S3,
  // Cloudflare Pages, Nginx...). O painel le o Supabase direto do browser.
  output: "export",
  images: { unoptimized: true },
  // URLs amigaveis para hosts estaticos (cada rota vira pasta/index.html).
  trailingSlash: true,
};

export default nextConfig;
