import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0007_spotty_sphinx.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0008_supabase_grants.sql"), "utf8");

const TABLES = ["consultation_note_sources", "consultation_notes", "consultation_note_revisions"];

describe("consultation notes domain database authorization", () => {
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

  it("scopes a Consultation Note to exactly one Order and optionally one Look via foreign keys", () => {
    expect(migration).toContain(
      'ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")',
    );
    expect(migration).toContain(
      'ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id")',
    );
  });

  it("scopes a Consultation Note revision to exactly one note", () => {
    expect(migration).toContain(
      'ALTER TABLE "consultation_note_revisions" ADD CONSTRAINT "consultation_note_revisions_consultation_note_id_consultation_notes_id_fk" FOREIGN KEY ("consultation_note_id") REFERENCES "public"."consultation_notes"("id")',
    );
  });
});
