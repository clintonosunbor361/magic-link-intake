import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = ["drizzle/0000_far_black_crow.sql", "drizzle/0001_thick_madrox.sql"]
  .map((file) => readFileSync(resolve(file), "utf8"))
  .join("\n");

describe("foundation database authorization", () => {
  it.each([
    "organizations",
    "staff_profiles",
    "organization_memberships",
    "audit_entries",
  ])("enables row-level security on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it("scopes membership reads to the authenticated Staff Member", () => {
    expect(migration).toContain('"organization_memberships"."user_id" = auth.uid()');
    expect(migration).not.toMatch(
      /POLICY[^;]+organization_memberships[^;]+FOR (INSERT|UPDATE|DELETE)/,
    );
  });

  it("limits audit reads to an active Super Admin in the same organization", () => {
    expect(migration).toContain('membership.organization_id = "audit_entries"."organization_id"');
    expect(migration).toContain("membership.user_id = auth.uid()");
    expect(migration).toContain("membership.archived_at is null");
    expect(migration).toContain("membership.role = 'super_admin'");
  });
});
