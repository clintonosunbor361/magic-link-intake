import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0031_remove_enquiries.sql"), "utf8");

function positionOf(statement: string) {
  const position = migration.indexOf(statement);
  expect(position, `Expected migration to contain: ${statement}`).toBeGreaterThanOrEqual(0);
  return position;
}

describe("client-first legacy data migration", () => {
  it("creates Clients for unlinked enquiries without auto-merging by contact details", () => {
    expect(migration).toContain('INSERT INTO "clients"');
    expect(migration).toContain('"converted_client_id" IS NULL');
    expect(migration).toContain('"linked_client_id" IS NULL');
    expect(migration).toContain('SELECT "enquiry"."id"');
  });

  it("uses explicit enquiry-to-Client links and enriches existing Clients", () => {
    expect(migration).toContain('COALESCE("enquiry"."converted_client_id", "enquiry"."linked_client_id", "enquiry"."id")');
    expect(migration).toContain('UPDATE "clients" AS "client"');
  });

  it("moves tasks, notes, magic-link ownership, and notifications before dropping legacy tables", () => {
    const dropEnquiries = positionOf('DROP TABLE IF EXISTS "enquiries" CASCADE');

    expect(positionOf('INSERT INTO "client_tasks"')).toBeLessThan(dropEnquiries);
    expect(positionOf('Legacy enquiry follow-up notes:')).toBeLessThan(dropEnquiries);
    expect(positionOf('UPDATE "magic_link_tokens" AS "token"')).toBeLessThan(dropEnquiries);
    expect(positionOf(`WHEN "source_type"::text = 'enquiry_task' THEN 'client_task'`)).toBeLessThan(dropEnquiries);
  });

  it("checks every legacy record has a destination before destructive statements", () => {
    const verification = positionOf('RAISE EXCEPTION \'Legacy enquiry migration verification failed');
    expect(verification).toBeLessThan(positionOf('DROP TABLE IF EXISTS "enquiry_tasks" CASCADE'));
    expect(verification).toBeLessThan(positionOf('ALTER TABLE "magic_link_tokens" DROP COLUMN IF EXISTS "enquiry_id"'));
  });
});
