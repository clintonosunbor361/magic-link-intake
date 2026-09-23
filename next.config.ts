import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.KUARTZ_E2E ? ".next/e2e-build" : ".next",
  turbopack: {
    root: process.cwd(),
  },
  // sharp ships native binaries; keep it out of the server bundle so Next loads it from node_modules directly.
  serverExternalPackages: ["@sparticuz/chromium", "pdf-lib", "puppeteer-core", "sharp"],
  outputFileTracingIncludes: {
    // Route keys use picomatch syntax. A literal `[assignmentId]` is interpreted as a character
    // class and silently misses the dynamic route, so use a wildcard for the segment.
    "/api/vendor-briefs/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/invoices/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  experimental: {
    serverActions: {
      // Style Direction Files cap the original upload at 15MB; leave headroom for multipart overhead.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
