import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.KUARTZ_E2E ? ".next/e2e-build" : ".next",
  // sharp ships native binaries; keep it out of the server bundle so Next loads it from node_modules directly.
  serverExternalPackages: ["@sparticuz/chromium", "pdf-lib", "puppeteer-core", "sharp"],
  outputFileTracingIncludes: {
    "/api/vendor-briefs/[assignmentId]": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/invoices/[invoiceId]": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  experimental: {
    serverActions: {
      // Style Direction Files cap the original upload at 15MB; leave headroom for multipart overhead.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
