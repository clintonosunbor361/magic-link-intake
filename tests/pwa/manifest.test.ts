import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("online-only PWA contract", () => {
  it("publishes an installable standalone manifest", () => {
    expect(manifest()).toEqual(
      expect.objectContaining({
        name: "Kuartz Fashion CRM",
        start_url: "/",
        scope: "/",
        display: "standalone",
      }),
    );
    expect(manifest().icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });

  it("caches only the dedicated offline fallback, not CRM records", () => {
    const worker = readFileSync(resolve("public/sw.js"), "utf8");
    expect(worker).toContain('const CACHE = "kuartz-shell-v2"');
    expect(worker).toContain("cache.addAll(OFFLINE_ASSETS)");
    expect(worker).toContain('caches.match("/offline")');
    expect(worker).not.toContain('caches.match("/")');
    expect(worker).not.toContain("event.request.method !== \"POST\"");
  });
});
