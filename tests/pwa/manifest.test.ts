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
        display: "standalone",
      }),
    );
  });

  it("caches only the dedicated offline fallback, not CRM records", () => {
    const worker = readFileSync(resolve("public/sw.js"), "utf8");
    expect(worker).toContain('cache.addAll(["/offline", "/kuartz-mark.svg"])');
    expect(worker).toContain('caches.match("/offline")');
    expect(worker).not.toContain('caches.match("/")');
  });
});
