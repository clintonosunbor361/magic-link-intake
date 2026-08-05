import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = ["drizzle/0003_cynical_franklin_storm.sql"]
  .map((file) => readFileSync(resolve(file), "utf8"))
  .join("\n");

const grants = readFileSync(resolve("drizzle/0004_supabase_grants.sql"), "utf8");

describe("enquiries domain database authorization", () => {
  it.each([
    "clients",
    "enquiries",
    "enquiry_notes",
    "enquiry_tasks",
    "looks",
    "magic_link_tokens",
    "orders",
  ])("enables row-level security on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each([
    "clients",
    "enquiries",
    "enquiry_notes",
    "enquiry_tasks",
    "looks",
    "magic_link_tokens",
    "orders",
  ])("scopes %s reads to members of the same organization", (table) => {
    expect(migration).toContain(`membership.organization_id = "${table}"."organization_id"`);
    expect(migration).toMatch(
      new RegExp(`POLICY[^;]+"${table}"[^;]+FOR SELECT`),
    );
    expect(migration).not.toMatch(
      new RegExp(`POLICY[^;]+"${table}"[^;]+FOR (INSERT|UPDATE|DELETE)`),
    );
  });

  it.each([
    "clients",
    "enquiries",
    "enquiry_notes",
    "enquiry_tasks",
    "looks",
    "magic_link_tokens",
    "orders",
  ])("grants SELECT on %s to authenticated staff", (table) => {
    expect(grants).toContain(`GRANT SELECT ON TABLE "${table}" TO "authenticated"`);
  });

  it("never persists a raw magic-link token, only its hash", () => {
    expect(migration).toContain('"token_hash" text NOT NULL');
    expect(migration).not.toMatch(/"token"\s+text/);
  });
});
