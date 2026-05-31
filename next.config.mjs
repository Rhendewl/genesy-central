/** @type {import('next').NextConfig} */
const nextConfig = {
  // lucide-react 1.x ships .mjs icon files; SWC loader needs .mjs support
  transpilePackages: ["lucide-react"],
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
