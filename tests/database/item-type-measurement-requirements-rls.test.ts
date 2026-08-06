import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0015_small_barracuda.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0016_supabase_grants.sql"), "utf8");

const TABLE = "item_type_measurement_requirements";

describe("item type measurement requirements domain database authorization", () => {
  it("enables row-level security", () => {
    expect(migration).toContain(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
  });

  it("scopes reads to members of the same organization", () => {
    expect(migration).toContain(`membership.organization_id = "${TABLE}"."organization_id"`);
    expect(migration).toMatch(new RegExp(`POLICY[^;]+"${TABLE}"[^;]+FOR SELECT`));
    expect(migration).not.toMatch(new RegExp(`POLICY[^;]+"${TABLE}"[^;]+FOR (INSERT|UPDATE|DELETE)`));
  });

  it("grants SELECT to authenticated staff", () => {
    expect(grants).toContain(`GRANT SELECT ON TABLE "${TABLE}" TO "authenticated"`);
  });

  it("enforces exactly one requirement per item type and field", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "item_type_measurement_requirements_type_field_uidx" ON "item_type_measurement_requirements" USING btree ("item_type_id","field_definition_id")',
    );
  });

  it("scopes a requirement to exactly one item type and one field definition via foreign keys", () => {
    expect(migration).toContain(
      'ALTER TABLE "item_type_measurement_requirements" ADD CONSTRAINT "item_type_measurement_requirements_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id")',
    );
    expect(migration).toContain(
      'ALTER TABLE "item_type_measurement_requirements" ADD CONSTRAINT "item_type_measurement_requirements_field_definition_id_measurement_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."measurement_field_definitions"("id")',
    );
  });
});
