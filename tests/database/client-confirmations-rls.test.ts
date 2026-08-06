import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0017_grey_speedball.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0018_supabase_grants.sql"), "utf8");

const TABLE = "client_confirmations";

describe("client confirmations domain database authorization", () => {
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

  it("enforces exactly one token per confirmation", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "client_confirmations_token_hash_uidx" ON "client_confirmations" USING btree ("token_hash")',
    );
  });

  it("scopes a confirmation to the staff member who created it via a foreign key", () => {
    expect(migration).toContain(
      'ALTER TABLE "client_confirmations" ADD CONSTRAINT "client_confirmations_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id")',
    );
  });

  it("does not constrain subject_id with a foreign key — subject_type picks the table it points at", () => {
    expect(migration).not.toMatch(/ADD CONSTRAINT "client_confirmations_subject_id_[^"]+_id_fk"/);
    expect(migration).toContain(
      'CREATE INDEX "client_confirmations_subject_idx" ON "client_confirmations" USING btree ("subject_type","subject_id")',
    );
  });
});
