import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0013_misty_paper_doll.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0014_supabase_grants.sql"), "utf8");

const TABLES = [
  "measurement_field_definitions",
  "measurement_profiles",
  "measurement_values",
  "measurement_value_revisions",
  "measurement_profile_attachments",
];

describe("measurement profiles domain database authorization", () => {
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

  it("enforces exactly one measurement profile per Client and one value per profile+field", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "measurement_profiles_org_client_uidx" ON "measurement_profiles" USING btree ("organization_id","client_id")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "measurement_values_profile_field_uidx" ON "measurement_values" USING btree ("measurement_profile_id","field_definition_id")',
    );
  });

  it("scopes a measurement profile to exactly one Client via a foreign key", () => {
    expect(migration).toContain(
      'ALTER TABLE "measurement_profiles" ADD CONSTRAINT "measurement_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")',
    );
  });

  it("scopes a revision to exactly one measurement value via a foreign key", () => {
    expect(migration).toContain(
      'ALTER TABLE "measurement_value_revisions" ADD CONSTRAINT "measurement_value_revisions_measurement_value_id_measurement_values_id_fk" FOREIGN KEY ("measurement_value_id") REFERENCES "public"."measurement_values"("id")',
    );
  });
});
