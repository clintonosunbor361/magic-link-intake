import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0009_wild_sue_storm.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0010_supabase_grants.sql"), "utf8");

const TABLES = ["style_direction_files", "style_direction_file_revisions"];

describe("style direction files domain database authorization", () => {
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

  it("scopes a Style Direction File to exactly one Order and optionally one Look via foreign keys", () => {
    expect(migration).toContain(
      'ALTER TABLE "style_direction_files" ADD CONSTRAINT "style_direction_files_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")',
    );
    expect(migration).toContain(
      'ALTER TABLE "style_direction_files" ADD CONSTRAINT "style_direction_files_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id")',
    );
  });

  it("scopes a revision to exactly one Style Direction File and enforces a unique revision number per file", () => {
    expect(migration).toContain(
      'ALTER TABLE "style_direction_file_revisions" ADD CONSTRAINT "style_direction_file_revisions_style_direction_file_id_style_direction_files_id_fk" FOREIGN KEY ("style_direction_file_id") REFERENCES "public"."style_direction_files"("id")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "style_direction_file_revisions_file_number_uidx" ON "style_direction_file_revisions" USING btree ("style_direction_file_id","revision_number")',
    );
  });
});
