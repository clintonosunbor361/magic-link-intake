import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0021_last_tenebrous.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0022_supabase_grants.sql"), "utf8");

const TABLES = ["invoices", "invoice_line_items", "client_payments", "vendor_payments"];

describe("finance database authorization", () => {
  it.each(TABLES)("enables row-level security on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each(TABLES)("scopes %s reads to members of the same organization", (table) => {
    expect(migration).toContain(`membership.organization_id = "${table}"."organization_id"`);
    expect(migration).toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR SELECT`));
    // Every financial write goes through a server action or route handler, never from the browser.
    expect(migration).not.toMatch(new RegExp(`POLICY[^;]+"${table}"[^;]+FOR (INSERT|UPDATE|DELETE)`));
  });

  it.each(TABLES)("grants SELECT on %s to authenticated staff", (table) => {
    expect(grants).toContain(`GRANT SELECT ON TABLE "${table}" TO "authenticated"`);
  });
});

describe("finance structural invariants", () => {
  it("enforces one Invoice per Order in the database, not just in service code", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "invoices_order_uidx" ON "invoices" USING btree ("order_id")',
    );
  });

  it("keeps invoice numbers unique within an organization", () => {
    // The counter is allocated from max(sequence) inside a transaction; this index is what makes a
    // concurrent allocation fail rather than reuse a number.
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "invoices_org_sequence_uidx" ON "invoices" USING btree ("organization_id","sequence")',
    );
  });

  it("stores no line amount and no invoice total, so neither can drift from its inputs", () => {
    const createLines = migration.slice(
      migration.indexOf('CREATE TABLE "invoice_line_items"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "invoice_line_items"')),
    );
    expect(createLines).toContain('"quantity" integer NOT NULL');
    expect(createLines).toContain('"unit_price_minor" integer NOT NULL');
    expect(createLines).not.toContain('"amount');

    const createInvoices = migration.slice(
      migration.indexOf('CREATE TABLE "invoices"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "invoices"')),
    );
    expect(createInvoices).not.toContain('"total');
  });

  it("stores only the three staff-driven Invoice states — Part Paid and Paid are derived", () => {
    expect(migration).toContain(`CREATE TYPE "public"."invoice_lifecycle_status" AS ENUM('draft', 'sent', 'void')`);
  });

  it("gives payments a void trail instead of allowing a delete", () => {
    for (const table of ["client_payments", "vendor_payments"]) {
      const create = migration.slice(
        migration.indexOf(`CREATE TABLE "${table}"`),
        migration.indexOf(");", migration.indexOf(`CREATE TABLE "${table}"`)),
      );
      expect(create).toContain('"voided_at" timestamp with time zone');
      expect(create).toContain('"void_reason" text');
      // Payments are immutable evidence: no archived_at, because they are corrected by voiding.
      expect(create).not.toContain('"archived_at"');
    }
  });

  it("holds money only in integer minor units", () => {
    for (const column of [
      '"unit_price_minor" integer',
      '"amount_minor" integer',
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).not.toMatch(/numeric|double precision|real\b/i);
  });

  it("records the completion gate outcome on the Order", () => {
    expect(migration).toContain('ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp with time zone');
    expect(migration).toContain('ALTER TABLE "orders" ADD COLUMN "completed_by_staff_id" uuid');
    expect(migration).toContain('ALTER TABLE "orders" ADD COLUMN "completion_override_reason" text');
  });

  it("ties each financial record to its parent and its actor", () => {
    for (const [table, column, parent] of [
      ["invoices", "order_id", "orders"],
      ["invoice_line_items", "invoice_id", "invoices"],
      ["client_payments", "invoice_id", "invoices"],
      ["vendor_payments", "vendor_assignment_id", "vendor_assignments"],
    ]) {
      expect(migration).toContain(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_${parent}_id_fk" FOREIGN KEY ("${column}") REFERENCES "public"."${parent}"("id")`,
      );
    }
  });
});
