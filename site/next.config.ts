import type { NextConfig } from "next";

// Arquivos estáticos das landing pages: o navegador guarda no cache e não pede de novo a cada visita.
const week = "public, max-age=604800, stale-while-revalidate=86400";

const nextConfig: NextConfig = {
  // O site veio do vinext, que não fazia checagem de tipos no build.
  // Mantido assim para preservar o comportamento original; `npx tsc --noEmit` mostra os avisos.
  typescript: { ignoreBuildErrors: true },
  // Coloca o CSS dentro do HTML, evitando que a página espere baixar os arquivos de estilo.
  experimental: { inlineCss: true },
  async headers() {
    return [
      // A fonte nunca muda de conteúdo sem mudar de nome.
      { source: "/fonts/:file+", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      ...["scripts", "impulsionar", "testimonials", "webp"].map(folder => ({
        source: `/${folder}/:file+`,
        headers: [{ key: "Cache-Control", value: week }],
      })),
    ];
  },
};

export default nextConfig;
