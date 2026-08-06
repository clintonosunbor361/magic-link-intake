import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0011_legal_landau.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0012_supabase_grants.sql"), "utf8");

const TABLES = ["style_direction_approval_batches", "style_direction_approval_batch_items"];

describe("style direction approvals domain database authorization", () => {
  it.each(TABLES)("enables row-level security on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each(TABLES)("scopes %s reads to members of the same organization", (table) => {
    expect(migration).toContain(`membership.organization_id = "${table}"."organization_id"`);
    expect(migration).toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR SELECT`));
    expect(migration).not.toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR (INSERT|UPDATE|DELETE)`));
  });

  it.each(TABLES)("grants SELECT on %s to authenticated staff", (table) => {
    expect(grants).toContain(`GRANT SELECT ON TABLE "${table}" TO "authenticated"`);
  });

  it("enforces a unique token hash per batch and exactly one revision per batch item", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "style_direction_approval_batches_token_hash_uidx" ON "style_direction_approval_batches" USING btree ("token_hash")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "style_direction_approval_batch_items_batch_revision_uidx" ON "style_direction_approval_batch_items" USING btree ("batch_id","style_direction_file_revision_id")',
    );
  });

  it("scopes a batch to exactly one Order via a foreign key", () => {
    expect(migration).toContain(
      'ALTER TABLE "style_direction_approval_batches" ADD CONSTRAINT "style_direction_approval_batches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")',
    );
  });
});
