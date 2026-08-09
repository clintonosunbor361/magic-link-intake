import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0023_famous_smiling_tiger.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0024_supabase_grants.sql"), "utf8");

const TABLES = [
  "accessory_types",
  "accessory_statuses",
  "accessory_items",
  "fitting_sessions",
  "fitting_session_notes",
  "fitting_session_history",
];

describe("accessories and fittings database authorization", () => {
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
});

describe("accessory structural invariants", () => {
  it("stores no delivery date — the date is inherited from a Look, never copied", () => {
    const createAccessories = migration.slice(
      migration.indexOf('CREATE TABLE "accessory_items"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "accessory_items"')),
    );
    expect(createAccessories).not.toContain("delivery_date");
    expect(createAccessories).not.toContain("due_date");
  });

  it("carries no money of its own, keeping the Invoice the single client-facing total", () => {
    const createAccessories = migration.slice(
      migration.indexOf('CREATE TABLE "accessory_items"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "accessory_items"')),
    );
    expect(createAccessories).not.toContain("_minor");
    expect(createAccessories).not.toContain("cost");
    expect(createAccessories).not.toContain("price");
  });

  it("has no vendor or production status, keeping Accessories out of those workflows", () => {
    const createAccessories = migration.slice(
      migration.indexOf('CREATE TABLE "accessory_items"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "accessory_items"')),
    );
    expect(createAccessories).not.toContain("vendor_id");
    expect(createAccessories).not.toContain("production_status_id");
  });

  it("gives accessory statuses the delivered marker the Order warning depends on", () => {
    expect(migration).toContain('"is_completed" boolean DEFAULT false NOT NULL');
  });

  it("allows a whole-Order Accessory by leaving look_id nullable", () => {
    const createAccessories = migration.slice(
      migration.indexOf('CREATE TABLE "accessory_items"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "accessory_items"')),
    );
    expect(createAccessories).toMatch(/"look_id" uuid(?!\s+NOT NULL)/);
    expect(createAccessories).toContain('"order_id" uuid NOT NULL');
  });
});

describe("fitting structural invariants", () => {
  it("fixes the status set rather than making it a configurable list", () => {
    expect(migration).toContain(
      `CREATE TYPE "public"."fitting_session_status" AS ENUM('scheduled', 'completed', 'missed', 'cancelled')`,
    );
  });

  it("adds fitting_session as a client confirmation subject", () => {
    expect(migration).toContain(
      `ALTER TYPE "public"."client_confirmation_subject_type" ADD VALUE 'fitting_session'`,
    );
  });

  it("keeps the client-visible summary separate from internal notes", () => {
    const createSessions = migration.slice(
      migration.indexOf('CREATE TABLE "fitting_sessions"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "fitting_sessions"')),
    );
    expect(createSessions).toContain('"client_summary" text');
    // Notes live in their own table precisely so they can never leak into the client payload.
    expect(createSessions).not.toContain('"notes"');
    expect(migration).toContain('CREATE TABLE "fitting_session_notes"');
  });

  it("records both status and schedule movement in history, since rescheduling overwrites the date", () => {
    const createHistory = migration.slice(
      migration.indexOf('CREATE TABLE "fitting_session_history"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "fitting_session_history"')),
    );
    expect(createHistory).toContain('"previous_scheduled_at"');
    expect(createHistory).toContain('"new_scheduled_at"');
    expect(createHistory).toContain('"previous_status"');
    expect(createHistory).toContain('"new_status"');
  });

  it("ties each record to its parent", () => {
    for (const [table, column, parent] of [
      ["accessory_items", "order_id", "orders"],
      ["accessory_items", "accessory_type_id", "accessory_types"],
      ["accessory_items", "accessory_status_id", "accessory_statuses"],
      ["fitting_sessions", "order_id", "orders"],
      ["fitting_session_notes", "fitting_session_id", "fitting_sessions"],
      ["fitting_session_history", "fitting_session_id", "fitting_sessions"],
    ]) {
      expect(migration).toContain(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_${parent}_id_fk" FOREIGN KEY ("${column}") REFERENCES "public"."${parent}"("id")`,
      );
    }
  });
});
