import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0025_round_network.sql"), "utf8");
const grants = readFileSync(resolve("drizzle/0026_supabase_grants.sql"), "utf8");
const vercelConfig = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));

describe("notifications database authorization", () => {
  it("enables row-level security", () => {
    expect(migration).toContain('ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY');
  });

  it("scopes reads to members of the same organization, with writes server-side only", () => {
    expect(migration).toContain('membership.organization_id = "notifications"."organization_id"');
    expect(migration).toMatch(/POLICY[^;]+"notifications"[^;]+FOR SELECT/);
    expect(migration).not.toMatch(/POLICY[^;]+"notifications"[^;]+FOR (INSERT|UPDATE|DELETE)/);
  });

  it("grants SELECT to authenticated staff", () => {
    expect(grants).toContain('GRANT SELECT ON TABLE "notifications" TO "authenticated"');
  });
});

describe("notification structural invariants", () => {
  it("makes idempotency structural via the unique key, including the due date", () => {
    // Without due_date in the key a rescheduled deadline would never warn again; with it, the
    // insert still cannot duplicate for an unchanged deadline.
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "notifications_source_trigger_due_uidx" ON "notifications" USING btree ("source_type","source_id","trigger","due_date")',
    );
  });

  it("defines the four sources and four triggers the spec names", () => {
    expect(migration).toContain(
      `CREATE TYPE "public"."notification_source_type" AS ENUM('enquiry_task', 'vendor_assignment', 'accessory_item', 'fitting_session')`,
    );
    expect(migration).toContain(
      `CREATE TYPE "public"."notification_trigger" AS ENUM('days_7', 'days_3', 'days_1', 'overdue')`,
    );
  });

  it("tracks email state separately, so a send failure cannot destroy the dashboard row", () => {
    const create = migration.slice(
      migration.indexOf('CREATE TABLE "notifications"'),
      migration.indexOf(");", migration.indexOf('CREATE TABLE "notifications"')),
    );
    expect(create).toContain('"email_state"');
    expect(create).toContain('"email_attempts" integer');
    expect(create).toContain('"email_last_error" text');
    // Read state is independent of delivery state.
    expect(create).toContain('"read_at"');
  });

  it("leaves source_id unconstrained, because the four parents live in four tables", () => {
    expect(migration).not.toContain('"notifications_source_id_');
  });
});

describe("cron configuration", () => {
  it("schedules the notification run daily at 06:00 UTC", () => {
    // 07:00 in Africa/Lagos: before the working day, and far from the date rollover so "due today"
    // is never ambiguous.
    expect(vercelConfig.crons).toContainEqual({
      path: "/api/cron/notifications",
      schedule: "0 6 * * *",
    });
  });
});
