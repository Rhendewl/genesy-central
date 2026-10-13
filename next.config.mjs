import { randomUUID } from "node:crypto";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  env: {
    NEXT_PUBLIC_APP_VERSION: [process.env.VERCEL_DEPLOYMENT_ID, process.env.VERCEL_URL, process.env.VERCEL_GIT_COMMIT_SHA]
      .map((value) => value?.trim()).find(Boolean)
      || (process.env.NODE_ENV === "production" ? randomUUID() : "development"),
  },
  // lucide-react 1.x ships .mjs icon files; SWC loader needs .mjs support
  transpilePackages: ["lucide-react"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config) => {
    // Allow webpack 5 to resolve .mjs imports from ESM packages in node_modules
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
    });
    return config;
  },
};

export default nextConfig;
