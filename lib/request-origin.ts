import "server-only";

import { headers } from "next/headers";

// process.env.NEXT_PUBLIC_* is inlined at build time, not read at request time — using it here
// would bake in whatever .env.local said during `next build`, which can silently diverge from
// the host actually serving the request (this is exactly how the e2e build vs. serve environments
// differ). Deriving the origin from the request's own headers, like the existing /api/intake-links
// route does via `request.url`, is correct regardless of what NEXT_PUBLIC_APP_URL says.
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}
