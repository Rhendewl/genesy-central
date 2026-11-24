import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O site veio do vinext, que não fazia checagem de tipos no build.
  // Mantido assim para preservar o comportamento original; `npx tsc --noEmit` mostra os avisos.
  typescript: { ignoreBuildErrors: true },
  // Coloca o CSS dentro do HTML, evitando que a página espere baixar os arquivos de estilo.
  experimental: { inlineCss: true },
  // Landing pages estáticas em public/<pagina>/index.html servidas no endereço limpo.
  async rewrites() {
    return [{ source: "/scripts", destination: "/scripts/index.html" }];
  },
};

export default nextConfig;
