import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  accessoryItems,
  accessoryStatuses,
  accessoryTypes,
  clients,
  clientTasks,
  fittingSessions,
  items,
  itemTypes,
  looks,
  notifications,
  orders,
  organizations,
  organizationMemberships,
  productionStatuses,
  staffProfiles,
  vendorAssignments,
  vendors,
} from "@/db/schema";
import { resolveAccessoryDeliveryDate } from "@/lib/accessories/delivery-date";
import { toBusinessDate } from "@/lib/domain/business-date";
import { MAX_EMAIL_ATTEMPTS, EMAIL_BATCH_SIZE, IDEMPOTENCY_WINDOW_MS, type CreatedNotification, type DeadlineSource, type NotificationRepository } from "@/lib/notifications/service";

export function createNotificationRepository(): NotificationRepository {
  const db = getDatabase();
  return {
    async insertMissing(input) {
      if (!input.planned.length) return [];

      // onConflictDoNothing against the unique key is the entire idempotency mechanism: a retried
      // or double-fired cron inserts nothing the second time, and `returning` reports only the rows
      // that were genuinely new — which is exactly the set eligible for a first email attempt.
      const rows = await db
        .insert(notifications)
        .values(
          input.planned.map((plan) => ({
            organizationId: input.organizationId,
            sourceType: plan.sourceType,
            sourceId: plan.sourceId,
            trigger: plan.trigger,
            dueDate: plan.dueDate,
            recipientStaffId: plan.recipientStaffId,
            title: plan.title,
            body: plan.body,
            href: plan.href,
            emailState: plan.emailEligible && plan.recipientStaffId ? "pending" as const : "skipped" as const,
            emailRetrySafe: true,
          })),
        )
        .onConflictDoNothing()
        .returning({
          id: notifications.id,
          sourceType: notifications.sourceType,
          sourceId: notifications.sourceId,
          trigger: notifications.trigger,
          dueDate: notifications.dueDate,
          recipientStaffId: notifications.recipientStaffId,
          title: notifications.title,
          body: notifications.body,
          href: notifications.href,
        });

      return rows as CreatedNotification[];
    },
    async listEmailCandidates(organizationId) {
      return db.select().from(notifications).where(and(
        eq(notifications.organizationId, organizationId),
        inArray(notifications.emailState, ["pending", "failed"]),
        lt(notifications.emailAttempts, MAX_EMAIL_ATTEMPTS),
        or(eq(notifications.emailAttempts, 0), eq(notifications.emailRetrySafe, true), gt(notifications.emailFirstAttemptAt, new Date(Date.now() - IDEMPOTENCY_WINDOW_MS))),
        isNull(notifications.archivedAt),
        or(isNull(notifications.emailClaimedAt), lt(notifications.emailClaimedAt, new Date(Date.now() - 5 * 60_000))),
      )).orderBy(asc(notifications.createdAt)).limit(EMAIL_BATCH_SIZE);
    },
    async claimEmail(input) {
      const claimId = randomUUID();
      const [row] = await db.update(notifications).set({
        emailClaimId: claimId, emailClaimedAt: input.now,
        emailAttempts: sql`${notifications.emailAttempts} + 1`,
        emailFirstAttemptAt: sql`coalesce(${notifications.emailFirstAttemptAt}, ${input.now.toISOString()}::timestamptz)`,
        emailPayload: sql`coalesce(${notifications.emailPayload}, ${JSON.stringify(input.payload)}::jsonb)`,
        // Until the outcome is acknowledged, this attempt may have reached Resend.
        emailRetrySafe: false,
      }).where(and(
        eq(notifications.organizationId, input.organizationId), eq(notifications.id, input.notificationId),
        eq(notifications.emailAttempts, input.expectedAttempts),
        inArray(notifications.emailState, ["pending", "failed"]),
        isNull(notifications.archivedAt),
        or(isNull(notifications.emailClaimedAt), lt(notifications.emailClaimedAt, new Date(input.now.getTime() - 5 * 60_000))),
      )).returning({ payload: notifications.emailPayload });
      return row?.payload ? { claimId, payload: row.payload } : null;
    },
    async recordEmailOutcome(input) {
      await db.update(notifications).set({
        emailState: input.outcome.state,
        emailSentAt: input.outcome.state === "sent" ? new Date() : null,
        emailLastError: input.outcome.state === "failed" ? input.outcome.error : null,
        emailRetrySafe: input.outcome.state === "failed" && input.outcome.retrySafe,
        emailClaimId: null, emailClaimedAt: null,
      }).where(and(eq(notifications.organizationId, input.organizationId),
        eq(notifications.id, input.notificationId), eq(notifications.emailClaimId, input.claimId)));
    },
    async getStaffEmail(organizationId, staffId) {
      const [row] = await db
        .select({ email: staffProfiles.email, fullName: staffProfiles.fullName })
        .from(staffProfiles)
        .innerJoin(organizationMemberships, eq(organizationMemberships.userId, staffProfiles.id))
        .where(and(eq(staffProfiles.id, staffId), eq(organizationMemberships.organizationId, organizationId), isNull(organizationMemberships.archivedAt)))
        .limit(1);
      return row ?? null;
    },
  };
}

export async function listOrganizationsForCron() {
  const db = getDatabase();
  return db
    .select({ id: organizations.id, name: organizations.name, timezone: organizations.timezone })
    .from(organizations)
    .where(isNull(organizations.archivedAt));
}

/**
 * Every open deadline in one organization, flattened into the shape the planner needs.
 *
 * Each source resolves a recipient. Client tasks carry their own assignee; production, accessories and fittings all roll up to the Order's primary owner.
 */
export async function collectDeadlineSources(
  organizationId: string,
  timezone: string,
): Promise<DeadlineSource[]> {
  const db = getDatabase();

  const [taskRows, assignmentRows, accessoryRows, lookRows, fittingRows] = await Promise.all([
    db
      .select({
        id: clientTasks.id,
        title: clientTasks.title,
        dueDate: clientTasks.dueDate,
        assignedToStaffId: clientTasks.assignedToStaffId,
        clientId: clientTasks.clientId,
        clientName: clients.fullName,
      })
      .from(clientTasks)
      .innerJoin(clients, eq(clients.id, clientTasks.clientId))
      .where(
        and(
          eq(clientTasks.organizationId, organizationId),
          eq(clientTasks.status, "open"),
          isNull(clientTasks.archivedAt),
          isNull(clients.archivedAt),
        ),
      ),
    db
      .select({
        id: vendorAssignments.id,
        deadline: vendorAssignments.deadline,
        vendorName: vendors.name,
        itemLabel: items.customLabel,
        itemTypeName: itemTypes.name,
        orderTitle: orders.title,
        primaryOwnerStaffId: orders.primaryOwnerStaffId,
        statusIsCompleted: productionStatuses.isCompleted,
      })
      .from(vendorAssignments)
      .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
      .innerJoin(items, eq(items.id, vendorAssignments.itemId))
      .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
      .innerJoin(looks, eq(looks.id, items.lookId))
      .innerJoin(orders, eq(orders.id, looks.orderId))
      .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
      .where(
        and(
          eq(vendorAssignments.organizationId, organizationId),
          isNull(vendorAssignments.archivedAt),
          isNull(items.archivedAt),
          isNull(looks.archivedAt),
          isNull(orders.archivedAt),
          // Finished work needs no reminder, and a completed Order is closed out entirely.
          eq(productionStatuses.isCompleted, false),
          isNull(orders.completedAt),
        ),
      ),
    db
      .select({
        id: accessoryItems.id,
        orderId: accessoryItems.orderId,
        lookId: accessoryItems.lookId,
        customLabel: accessoryItems.customLabel,
        assignedToStaffId: accessoryItems.assignedToStaffId,
        typeName: accessoryTypes.name,
        orderTitle: orders.title,
        primaryOwnerStaffId: orders.primaryOwnerStaffId,
      })
      .from(accessoryItems)
      .innerJoin(accessoryTypes, eq(accessoryTypes.id, accessoryItems.accessoryTypeId))
      .innerJoin(accessoryStatuses, eq(accessoryStatuses.id, accessoryItems.accessoryStatusId))
      .innerJoin(orders, eq(orders.id, accessoryItems.orderId))
      .where(
        and(
          eq(accessoryItems.organizationId, organizationId),
          isNull(accessoryItems.archivedAt),
          isNull(orders.archivedAt),
          eq(accessoryStatuses.isCompleted, false),
          isNull(orders.completedAt),
        ),
      ),
    db
      .select({ id: looks.id, orderId: looks.orderId, lookDate: looks.lookDate, archivedAt: looks.archivedAt })
      .from(looks)
      .where(eq(looks.organizationId, organizationId)),
    db
      .select({
        id: fittingSessions.id,
        orderId: fittingSessions.orderId,
        scheduledAt: fittingSessions.scheduledAt,
        lookName: looks.name,
        orderTitle: orders.title,
        clientName: clients.fullName,
        primaryOwnerStaffId: orders.primaryOwnerStaffId,
      })
      .from(fittingSessions)
      .innerJoin(orders, eq(orders.id, fittingSessions.orderId))
      .innerJoin(clients, eq(clients.id, orders.clientId))
      .leftJoin(looks, eq(looks.id, fittingSessions.lookId))
      .where(
        and(
          eq(fittingSessions.organizationId, organizationId),
          isNull(fittingSessions.archivedAt),
          isNull(orders.archivedAt),
          // Only sessions still going to happen; concluded ones are history.
          eq(fittingSessions.status, "scheduled"),
        ),
      ),
  ]);

  const looksByOrder = new Map<string, { id: string; lookDate: string | null; archivedAt: Date | null }[]>();
  for (const look of lookRows) {
    const bucket = looksByOrder.get(look.orderId) ?? [];
    bucket.push({ id: look.id, lookDate: look.lookDate, archivedAt: look.archivedAt });
    looksByOrder.set(look.orderId, bucket);
  }

  const sources: DeadlineSource[] = [];

  for (const task of taskRows) {
    sources.push({
      sourceType: "client_task",
      sourceId: task.id,
      dueDate: task.dueDate,
      subject: task.title,
      context: task.clientName,
      href: `/clients/${task.clientId}`,
      recipientStaffId: task.assignedToStaffId,
    });
  }

  for (const assignment of assignmentRows) {
    sources.push({
      sourceType: "vendor_assignment",
      sourceId: assignment.id,
      dueDate: assignment.deadline,
      subject: assignment.itemLabel || assignment.itemTypeName,
      context: `${assignment.vendorName} · ${assignment.orderTitle}`,
      href: `/production/${assignment.id}`,
      recipientStaffId: assignment.primaryOwnerStaffId,
    });
  }

  // Accessories have no stored date — the reminder resolves the inherited Look date the same way
  // the UI does, so a moved Look shifts the reminder with it.
  for (const accessory of accessoryRows) {
    const resolved = resolveAccessoryDeliveryDate({
      lookId: accessory.lookId,
      looks: looksByOrder.get(accessory.orderId) ?? [],
    });
    if (resolved.state !== "inherited") continue;

    sources.push({
      sourceType: "accessory_item",
      sourceId: accessory.id,
      dueDate: resolved.date,
      subject: accessory.customLabel || accessory.typeName,
      context: accessory.orderTitle,
      href: `/orders/${accessory.orderId}/accessories`,
      recipientStaffId: accessory.assignedToStaffId ?? accessory.primaryOwnerStaffId,
    });
  }

  // A fitting is stored as an instant; the reminder windows are day-based, so it is read as a
  // calendar day in the organization's zone — the same zone the badge and the filters use.
  for (const fitting of fittingRows) {
    sources.push({
      sourceType: "fitting_session",
      sourceId: fitting.id,
      dueDate: toBusinessDate(fitting.scheduledAt, timezone),
      subject: fitting.lookName ? `${fitting.orderTitle} · ${fitting.lookName}` : fitting.orderTitle,
      context: fitting.clientName,
      href: `/orders/${fitting.orderId}/fittings`,
      recipientStaffId: fitting.primaryOwnerStaffId,
    });
  }

  return sources;
}

export async function listNotifications(
  organizationId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  const db = getDatabase();
  const conditions = [eq(notifications.organizationId, organizationId), isNull(notifications.archivedAt)];
  if (options.unreadOnly) conditions.push(isNull(notifications.readAt));

  const query = db
    .select({
      id: notifications.id,
      sourceType: notifications.sourceType,
      trigger: notifications.trigger,
      dueDate: notifications.dueDate,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      emailState: notifications.emailState,
      emailAttempts: notifications.emailAttempts,
      emailFirstAttemptAt: notifications.emailFirstAttemptAt,
      emailRetrySafe: notifications.emailRetrySafe,
      createdAt: notifications.createdAt,
      recipientName: staffProfiles.fullName,
    })
    .from(notifications)
    .leftJoin(staffProfiles, eq(staffProfiles.id, notifications.recipientStaffId))
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));

  return options.limit ? query.limit(options.limit) : query;
}

export async function countUnreadNotifications(organizationId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        isNull(notifications.readAt),
        isNull(notifications.archivedAt),
      ),
    );
  return row?.count ?? 0;
}

export async function markNotificationRead(organizationId: string, notificationId: string): Promise<void> {
  const db = getDatabase();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.id, notificationId),
        isNull(notifications.readAt),
      ),
    );
}

export async function markAllNotificationsRead(organizationId: string): Promise<void> {
  const db = getDatabase();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.organizationId, organizationId), isNull(notifications.readAt)));
}

