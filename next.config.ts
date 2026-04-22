import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker deployment
  output: "standalone",

  // Optimize for production
  poweredByHeader: false,

  // Strict mode for development
  reactStrictMode: true,
};

export default nextConfig;
