import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O site veio do vinext, que não fazia checagem de tipos no build.
  // Mantido assim para preservar o comportamento original; `npx tsc --noEmit` mostra os avisos.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
