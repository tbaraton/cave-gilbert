import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  // Désactive Turbopack pour la prod (génère des class static blocks incompatibles Safari 15)
  // Next.js 16 : utilise webpack à la place
  experimental: {
    turbo: {
      rules: {},
    },
  },
};

export default nextConfig;