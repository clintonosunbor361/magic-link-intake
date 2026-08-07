import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0019_bizarre_mandroid.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0020_supabase_grants.sql"), "utf8");

const TABLES = [
  "vendors",
  "vendor_specialties",
  "vendor_specialty_assignments",
  "production_statuses",
  "vendor_assignments",
  "production_status_history",
  "production_notes",
  "vendor_ratings",
  "vendor_rating_revisions",
];

describe("vendors and production database authorization", () => {
  it.each(TABLES)("enables row-level security on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each(TABLES)("scopes %s reads to members of the same organization", (table) => {
    expect(migration).toContain(`membership.organization_id = "${table}"."organization_id"`);
    expect(migration).toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR SELECT`));
    // Writes go through server-side services, never straight from the browser under RLS.
    expect(migration).not.toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR (INSERT|UPDATE|DELETE)`));
  });

  it.each(TABLES)("grants SELECT on %s to authenticated staff", (table) => {
    expect(grants).toContain(`GRANT SELECT ON TABLE "${table}" TO "authenticated"`);
  });
});

describe("vendor assignment structural invariants", () => {
  it("enforces one live Vendor per Item in the database, not just in service code", () => {
    // The partial predicate is the whole point: archived assignments are the residue of a
    // reassignment and must be allowed to pile up against the same Item.
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "vendor_assignments_live_item_uidx" ON "vendor_assignments" USING btree ("item_id") WHERE archived_at is null',
    );
  });

  it("ties an assignment to exactly one Item, Vendor, and production status", () => {
    for (const [column, table] of [
      ["item_id", "items"],
      ["vendor_id", "vendors"],
      ["production_status_id", "production_statuses"],
    ]) {
      expect(migration).toContain(
        `ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_${column}_${table}_id_fk" FOREIGN KEY ("${column}") REFERENCES "public"."${table}"("id")`,
      );
    }
  });

  it("keeps one rating per Order and Vendor", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "vendor_ratings_order_vendor_uidx" ON "vendor_ratings" USING btree ("order_id","vendor_id")',
    );
  });

  it("stores no overall rating column, so it cannot drift from its criteria", () => {
    const createRatings = migration.slice(
      migration.indexOf('CREATE TABLE "vendor_ratings"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "vendor_ratings"')),
    );
    expect(createRatings).toContain('"quality" integer NOT NULL');
    expect(createRatings).toContain('"timeliness" integer NOT NULL');
    expect(createRatings).toContain('"communication" integer NOT NULL');
    expect(createRatings).not.toContain('"overall"');
  });

  it("gives the organization a timezone that business dates resolve in", () => {
    expect(migration).toContain(
      `ALTER TABLE "organizations" ADD COLUMN "timezone" text DEFAULT 'Africa/Lagos' NOT NULL`,
    );
  });

  it("indexes the deadline and status columns the production workspace filters on", () => {
    expect(migration).toContain(
      'CREATE INDEX "vendor_assignments_org_deadline_idx" ON "vendor_assignments" USING btree ("organization_id","deadline")',
    );
    expect(migration).toContain(
      'CREATE INDEX "vendor_assignments_status_idx" ON "vendor_assignments" USING btree ("production_status_id")',
    );
  });
});
