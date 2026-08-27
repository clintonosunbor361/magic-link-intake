import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0032_add_accessory_sourcing_metadata.sql"), "utf8");
const constraintMigration = readFileSync(resolve("drizzle/0033_enforce_accessory_budget.sql"), "utf8");

describe("accessory sourcing metadata migration", () => {
  it("adds the four optional sourcing fields without inventing a separate delivery date", () => {
    expect(migration).toContain('ADD COLUMN "assigned_to_staff_id" uuid');
    expect(migration).toContain('ADD COLUMN "supplier" text');
    expect(migration).toContain('ADD COLUMN "budget_minor" integer');
    expect(migration).toContain('ADD COLUMN "purchase_date" date');
    expect(migration).not.toContain('ADD COLUMN "delivery_date"');
  });

  it("keeps assignment within active staff semantics rather than creating a vendor assignment", () => {
    expect(migration).toContain(
      'FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."staff_profiles"("id")',
    );
    expect(migration).toContain(
      'CREATE INDEX "accessory_items_org_assignee_idx" ON "accessory_items" USING btree ("organization_id", "assigned_to_staff_id")',
    );
    expect(migration).not.toContain("vendor_assignment_id");
  });

  it("defends the non-negative budget invariant in Postgres", () => {
    expect(constraintMigration).toContain(
      'CONSTRAINT "accessory_items_budget_nonnegative_check" CHECK ("accessory_items"."budget_minor" is null or "accessory_items"."budget_minor" >= 0)',
    );
  });
});
