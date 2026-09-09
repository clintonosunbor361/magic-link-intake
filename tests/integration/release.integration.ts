import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql, TransactionRollbackError } from "drizzle-orm";
import * as schema from "@/db/schema";
import { collectDeadlineSources, createNotificationRepository } from "@/lib/notifications/repository";
import { dispatchNotifications, NotificationDeliveryError, planNotifications } from "@/lib/notifications/service";
import { createFittingSessionRepository } from "@/lib/fittings/repository";
import { createClientConfirmationDecisionRepository } from "@/lib/client-confirmations/repository";

const url = process.env.DATABASE_URL!;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Integration tests require a local database.");
const connection = postgres(url, { max: 1, prepare: false });
const database = drizzle(connection, { schema });
let activeDatabase = database;
vi.mock("@/db", () => ({ getDatabase: () => activeDatabase }));
afterAll(() => connection.end());

async function fixture(run: (ids: { org: string; otherOrg: string; owner: string; assignee: string; client: string; order: string; look: string; task: string; fitting: string }) => Promise<void>) {
  try {
    await database.transaction(async (tx) => {
      activeDatabase = tx as unknown as typeof database;
      const org = randomUUID(), otherOrg = randomUUID(), owner = randomUUID(), assignee = randomUUID();
      await tx.insert(schema.organizations).values([{ id: org, name: "Release fixture", slug: org }, { id: otherOrg, name: "Other fixture", slug: otherOrg }]);
      await tx.insert(schema.staffProfiles).values([{ id: owner, fullName: "Owner", email: `${owner}@example.test` }, { id: assignee, fullName: "Assignee", email: `${assignee}@example.test` }]);
      await tx.insert(schema.organizationMemberships).values([{ organizationId: org, userId: owner, role: "super_admin" }, { organizationId: org, userId: assignee, role: "admin_assistant" }]);
      const [client] = await tx.insert(schema.clients).values({ organizationId: org, fullName: "Fixture Client", nameNormalized: "fixture client", primaryPhone: "08012345678", primaryPhoneNormalized: "08012345678" }).returning();
      const [order] = await tx.insert(schema.orders).values({ organizationId: org, clientId: client.id, title: "Fixture Order", eventType: "Wedding", finalAgreedPriceMinor: 10000, primaryOwnerStaffId: owner }).returning();
      const [look] = await tx.insert(schema.looks).values({ organizationId: org, orderId: order.id, name: "Ceremony", lookDate: "2026-09-11" }).returning();
      const [task] = await tx.insert(schema.clientTasks).values({ organizationId: org, clientId: client.id, title: "Call Client", dueDate: "2026-09-11", assignedToStaffId: assignee, createdByStaffId: owner }).returning();
      const [fitting] = await tx.insert(schema.fittingSessions).values({ organizationId: org, orderId: order.id, lookId: look.id, scheduledAt: new Date("2026-09-11T10:00:00Z"), scheduledByStaffId: owner }).returning();
      await run({ org, otherOrg, owner, assignee, client: client.id, order: order.id, look: look.id, task: task.id, fitting: fitting.id });
      tx.rollback();
    });
  } catch (error) { if (!(error instanceof TransactionRollbackError)) throw error; }
}

describe("local notification delivery", () => {
  it("routes accessories to assignee then owner, and excludes whole-Order accessories", () => fixture(async (ids) => {
    const [type] = await activeDatabase.insert(schema.accessoryTypes).values({ organizationId: ids.org, name: "Shoes" }).returning();
    const [status] = await activeDatabase.insert(schema.accessoryStatuses).values({ organizationId: ids.org, name: "Sourcing" }).returning();
    const rows = await activeDatabase.insert(schema.accessoryItems).values([
      { organizationId: ids.org, orderId: ids.order, lookId: ids.look, accessoryTypeId: type.id, accessoryStatusId: status.id, assignedToStaffId: ids.assignee },
      { organizationId: ids.org, orderId: ids.order, lookId: ids.look, accessoryTypeId: type.id, accessoryStatusId: status.id },
      { organizationId: ids.org, orderId: ids.order, accessoryTypeId: type.id, accessoryStatusId: status.id },
    ]).returning();
    const sources = await collectDeadlineSources(ids.org, "Africa/Lagos");
    expect(sources.find((s) => s.sourceId === rows[0].id)?.recipientStaffId).toBe(ids.assignee);
    expect(sources.find((s) => s.sourceId === rows[1].id)?.recipientStaffId).toBe(ids.owner);
    expect(sources.some((s) => s.sourceId === rows[2].id)).toBe(false);
    expect(sources.find((s) => s.sourceId === ids.task)?.recipientStaffId).toBe(ids.assignee);
    expect(sources.find((s) => s.sourceId === ids.fitting)?.recipientStaffId).toBe(ids.owner);
  }));

  it("persists failures, retries the same notification once, and isolates recipients and RLS", () => fixture(async (ids) => {
    const repository = createNotificationRepository();
    const sources = (await collectDeadlineSources(ids.org, "Africa/Lagos")).filter((s) => s.sourceId === ids.task);
    const planned = planNotifications({ sources, today: "2026-09-08" });
    const input = { organizationId: ids.org, planned, appOrigin: "https://example.test" };
    const sender = { sendDeadlineEmail: vi.fn().mockRejectedValueOnce(new NotificationDeliveryError("Rate limited", true)).mockResolvedValue(undefined) };
    expect(await dispatchNotifications(input, repository, sender)).toMatchObject({ created: 2, failed: 1 });
    expect(await dispatchNotifications(input, repository, sender)).toMatchObject({ created: 0, emailed: 1 });
    await dispatchNotifications(input, repository, sender);
    expect(sender.sendDeadlineEmail).toHaveBeenCalledTimes(2);
    expect(sender.sendDeadlineEmail.mock.calls[0][0]).toEqual(sender.sendDeadlineEmail.mock.calls[1][0]);
    expect(await repository.getStaffEmail(ids.otherOrg, ids.assignee)).toBeNull();
    await activeDatabase.update(schema.organizationMemberships).set({ archivedAt: new Date() }).where(eq(schema.organizationMemberships.userId, ids.assignee));
    expect(await repository.getStaffEmail(ids.org, ids.assignee)).toBeNull();
    await activeDatabase.execute(sql`set local role authenticated`);
    await activeDatabase.execute(sql`select set_config('request.jwt.claim.sub', ${ids.owner}, true)`);
    expect(await activeDatabase.select().from(schema.notifications)).toHaveLength(2);
    await activeDatabase.execute(sql`select set_config('request.jwt.claim.sub', ${randomUUID()}, true)`);
    expect(await activeDatabase.select().from(schema.notifications)).toHaveLength(0);
  }));

  it("claims once and does not let old ambiguous records starve new work", () => fixture(async (ids) => {
    const repository = createNotificationRepository();
    await activeDatabase.insert(schema.notifications).values(Array.from({ length: 100 }, () => ({ organizationId: ids.org, sourceType: "client_task" as const, sourceId: randomUUID(), trigger: "overdue" as const, dueDate: "2026-09-01", title: "Old", href: "/clients", emailState: "failed" as const, emailAttempts: 1, emailFirstAttemptAt: new Date(Date.now() - 48 * 3600_000) })));
    const planned = planNotifications({ sources: [{ sourceType: "client_task", sourceId: ids.task, dueDate: "2026-09-11", subject: "Call", context: "", href: "/clients", recipientStaffId: ids.owner }], today: "2026-09-08" });
    await repository.insertMissing({ organizationId: ids.org, planned });
    const [row] = await repository.listEmailCandidates(ids.org);
    expect(row.title).toBe("To-do: Call");
    const input = { organizationId: ids.org, notificationId: row.id, expectedAttempts: 0, now: new Date(), payload: { to: "test@example.test", staffName: "Test", title: "Test", body: "Test", url: "https://example.test" } };
    expect(await repository.claimEmail(input)).not.toBeNull();
    expect(await repository.claimEmail(input)).toBeNull();
  }));

  it("preserves uncertainty after a later rejection and retains queued eligibility after trigger day", () => fixture(async (ids) => {
    const repository = createNotificationRepository();
    const sources = (await collectDeadlineSources(ids.org, "Africa/Lagos")).filter((s) => s.sourceId === ids.task);
    const planned = planNotifications({ sources, today: "2026-09-08" });
    await repository.insertMissing({ organizationId: ids.org, planned });
    const input = { organizationId: ids.org, planned: planNotifications({ sources, today: "2026-09-09" }), appOrigin: "https://example.test" };
    const sender = { sendDeadlineEmail: vi.fn().mockRejectedValueOnce(new Error("timeout")).mockRejectedValueOnce(new NotificationDeliveryError("Rate limited", true)) };
    expect(await dispatchNotifications(input, repository, sender)).toMatchObject({ failed: 1 });
    expect(await dispatchNotifications(input, repository, sender)).toMatchObject({ failed: 1 });
    const [row] = await repository.listEmailCandidates(ids.org);
    expect(row.emailRetrySafe).toBe(false);
  }));
});

describe("fitting confirmation history", () => {
  it("reschedule invalidates pending links and marks completed responses historical", () => fixture(async (ids) => {
    const pendingToken = randomUUID();
    await activeDatabase.insert(schema.clientConfirmations).values([
      { organizationId: ids.org, subjectType: "fitting_session", subjectId: ids.fitting, tokenHash: pendingToken, expiresAt: new Date(Date.now() + 86400_000), createdByStaffId: ids.owner },
      { organizationId: ids.org, subjectType: "fitting_session", subjectId: ids.fitting, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 86400_000), createdByStaffId: ids.owner, completedAt: new Date(), decisionStatus: "confirmed" },
    ]);
    await createFittingSessionRepository().rescheduleSession({ organizationId: ids.org, sessionId: ids.fitting, scheduledAt: new Date("2026-09-12T10:00:00Z"), previousScheduledAt: new Date("2026-09-11T10:00:00Z"), location: "Studio", status: "scheduled", note: "Moved", actorStaffId: ids.owner, expectedVersion: 1, nextVersion: 2 });
    const confirmations = await activeDatabase.select().from(schema.clientConfirmations).where(eq(schema.clientConfirmations.subjectId, ids.fitting));
    expect(confirmations.every((c) => c.supersededAt !== null)).toBe(true);
    expect(confirmations.find((c) => c.decisionStatus === "confirmed")?.completedAt).not.toBeNull();
    expect(await createClientConfirmationDecisionRepository().applyDecisionAndMaybeComplete({ tokenHash: pendingToken, decision: "confirmed", comment: "" })).toMatchObject({ ok: false });
  }));
});
