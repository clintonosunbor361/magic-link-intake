import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.KUARTZ_E2E ? ".next/e2e-build" : ".next",
};

export default nextConfig;
