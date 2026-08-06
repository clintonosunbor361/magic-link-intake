import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0005_fancy_marten_broadcloak.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0006_supabase_grants.sql"), "utf8");

describe("clients/orders domain database authorization", () => {
  it.each(["item_types", "items"])("enables row-level security on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each(["item_types", "items"])("scopes %s reads to members of the same organization", (table) => {
    expect(migration).toContain(`membership.organization_id = "${table}"."organization_id"`);
    expect(migration).toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR SELECT`));
    expect(migration).not.toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR (INSERT|UPDATE|DELETE)`));
  });

  it.each(["item_types", "items"])("grants SELECT on %s to authenticated staff", (table) => {
    expect(grants).toContain(`GRANT SELECT ON TABLE "${table}" TO "authenticated"`);
  });

  it("scopes an Item to exactly one Look and one Item Type via foreign keys", () => {
    expect(migration).toContain(
      'ALTER TABLE "items" ADD CONSTRAINT "items_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id")',
    );
    expect(migration).toContain(
      'ALTER TABLE "items" ADD CONSTRAINT "items_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id")',
    );
  });
});
