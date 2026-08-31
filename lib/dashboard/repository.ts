import "server-only";

import { and, asc, eq, gt, gte, isNull, lte, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  clients,
  clientConfirmations,
  clientTasks,
  fittingSessions,
  items,
  itemTypes,
  looks,
  measurementProfiles,
  orders,
  productionStatuses,
  staffProfiles,
  styleDirectionApprovalBatches,
  styleDirectionApprovalBatchItems,
  styleDirectionFiles,
  vendorAssignments,
  vendors,
} from "@/db/schema";
import { type BusinessDate, toBusinessDate } from "@/lib/domain/business-date";
import { sortOpenTodosByDueDate } from "@/lib/dashboard/overview";
import { shiftDays } from "@/lib/notifications/triggers";

// The dashboard's queries. Each one backs a metric the spec names, and each returns enough to render
// a row and link somewhere useful — the dashboard is a way into the work, not a wall of numbers.

/** Clients with at least one live, uncompleted Order. */
export async function countActiveClients(organizationId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${orders.clientId})::int` })
    .from(orders)
    .where(
      and(eq(orders.organizationId, organizationId), isNull(orders.archivedAt), isNull(orders.completedAt)),
    );
  return row?.count ?? 0;
}

export async function getOrderPipelineCounts(organizationId: string, today: BusinessDate) {
  const db = getDatabase();
  const [row] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      activeOrders: sql<number>`count(*) filter (where ${orders.completedAt} is null)::int`,
      completedOrders: sql<number>`count(*) filter (where ${orders.completedAt} is not null)::int`,
      delayedOrders: sql<number>`count(*) filter (where ${orders.completedAt} is null and exists (
        select 1
        from "vendor_assignments" delayed_assignments
        inner join "items" delayed_items on delayed_items."id" = delayed_assignments."item_id"
        inner join "looks" delayed_looks on delayed_looks."id" = delayed_items."look_id"
        inner join "production_statuses" delayed_statuses on delayed_statuses."id" = delayed_assignments."production_status_id"
        where delayed_looks."order_id" = "orders"."id"
          and delayed_assignments."archived_at" is null
          and delayed_items."archived_at" is null
          and delayed_looks."archived_at" is null
          and delayed_statuses."is_completed" = false
          and delayed_assignments."deadline" < ${today}
      ))::int`,
    })
    .from(orders)
    .where(and(eq(orders.organizationId, organizationId), isNull(orders.archivedAt)));

  return {
    totalOrders: row?.totalOrders ?? 0,
    activeOrders: row?.activeOrders ?? 0,
    completedOrders: row?.completedOrders ?? 0,
    delayedOrders: row?.delayedOrders ?? 0,
  };
}

/** Upcoming Look dates — the event countdowns the spec asks for, soonest first. */
export async function listUpcomingLookDates(organizationId: string, today: BusinessDate, days = 60) {
  const db = getDatabase();
  return db
    .select({
      lookId: looks.id,
      lookName: looks.name,
      lookDate: looks.lookDate,
      orderId: orders.id,
      orderTitle: orders.title,
      clientName: clients.fullName,
    })
    .from(looks)
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(
      and(
        eq(looks.organizationId, organizationId),
        isNull(looks.archivedAt),
        isNull(orders.archivedAt),
        isNull(orders.completedAt),
        gte(looks.lookDate, today),
        lte(looks.lookDate, shiftDays(today, days)),
      ),
    )
    .orderBy(asc(looks.lookDate));
}

export async function listUpcomingFittings(organizationId: string, from: Date, days = 30) {
  const db = getDatabase();
  const until = new Date(from.getTime() + days * 86_400_000);

  return db
    .select({
      id: fittingSessions.id,
      scheduledAt: fittingSessions.scheduledAt,
      orderId: fittingSessions.orderId,
      orderTitle: orders.title,
      clientName: clients.fullName,
      lookName: looks.name,
    })
    .from(fittingSessions)
    .innerJoin(orders, eq(orders.id, fittingSessions.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .leftJoin(looks, eq(looks.id, fittingSessions.lookId))
    .where(
      and(
        eq(fittingSessions.organizationId, organizationId),
        eq(fittingSessions.status, "scheduled"),
        isNull(fittingSessions.archivedAt),
        isNull(orders.archivedAt),
        gte(fittingSessions.scheduledAt, from),
        lte(fittingSessions.scheduledAt, until),
      ),
    )
    .orderBy(asc(fittingSessions.scheduledAt));
}

/** Items behind schedule: a live assignment past its deadline and not at a completed status. */
export async function listDelayedAssignments(organizationId: string, today: BusinessDate) {
  const db = getDatabase();
  return db
    .select({
      assignmentId: vendorAssignments.id,
      deadline: vendorAssignments.deadline,
      vendorName: vendors.name,
      itemLabel: items.customLabel,
      itemTypeName: itemTypes.name,
      statusName: productionStatuses.name,
      orderId: orders.id,
      orderTitle: orders.title,
      clientName: clients.fullName,
    })
    .from(vendorAssignments)
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
    .where(
      and(
        eq(vendorAssignments.organizationId, organizationId),
        isNull(vendorAssignments.archivedAt),
        isNull(orders.archivedAt),
        isNull(orders.completedAt),
        eq(productionStatuses.isCompleted, false),
        sql`${vendorAssignments.deadline} < ${today}`,
      ),
    )
    .orderBy(asc(vendorAssignments.deadline));
}

/** Every active Approval or Confirmation awaiting a Client response. */
export async function listAwaitingClientResponses(organizationId: string, now = new Date()) {
  const db = getDatabase();
  const approvals = await db
    .select({
      key: styleDirectionApprovalBatchItems.id,
      type: sql<string>`'Style Direction approval'`,
      orderId: orders.id,
      label: orders.title,
      clientName: clients.fullName,
      createdAt: styleDirectionApprovalBatches.createdAt,
      expiresAt: styleDirectionApprovalBatches.expiresAt,
    })
    .from(styleDirectionApprovalBatchItems)
    .innerJoin(styleDirectionApprovalBatches, eq(styleDirectionApprovalBatches.id, styleDirectionApprovalBatchItems.batchId))
    .innerJoin(styleDirectionFiles, eq(styleDirectionFiles.id, styleDirectionApprovalBatchItems.styleDirectionFileId))
    .innerJoin(orders, eq(orders.id, styleDirectionApprovalBatches.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(
      and(
        eq(styleDirectionApprovalBatches.organizationId, organizationId),
        eq(styleDirectionApprovalBatchItems.decisionStatus, "pending"),
        isNull(styleDirectionApprovalBatches.completedAt),
        isNull(styleDirectionApprovalBatches.supersededAt),
        gt(styleDirectionApprovalBatches.expiresAt, now),
        isNull(styleDirectionFiles.archivedAt),
        isNull(orders.archivedAt),
      ),
    );

  const activeConfirmation = and(eq(clientConfirmations.organizationId, organizationId), eq(clientConfirmations.decisionStatus, "pending"), isNull(clientConfirmations.completedAt), isNull(clientConfirmations.supersededAt), gt(clientConfirmations.expiresAt, now));
  const orderConfirmations = await db.select({ key: clientConfirmations.id, type: sql<string>`'Order confirmation'`, orderId: orders.id, label: orders.title, clientName: clients.fullName, createdAt: clientConfirmations.createdAt, expiresAt: clientConfirmations.expiresAt }).from(clientConfirmations).innerJoin(orders, eq(orders.id, clientConfirmations.subjectId)).innerJoin(clients, eq(clients.id, orders.clientId)).where(and(activeConfirmation, eq(clientConfirmations.subjectType, "order_detail"), isNull(orders.archivedAt)));
  const measurementConfirmations = await db.select({ key: clientConfirmations.id, type: sql<string>`'Measurement confirmation'`, orderId: sql<string | null>`null`, clientId: clients.id, label: sql<string>`${clients.fullName} || ' measurements'`, clientName: clients.fullName, createdAt: clientConfirmations.createdAt, expiresAt: clientConfirmations.expiresAt }).from(clientConfirmations).innerJoin(measurementProfiles, eq(measurementProfiles.id, clientConfirmations.subjectId)).innerJoin(clients, eq(clients.id, measurementProfiles.clientId)).where(and(activeConfirmation, eq(clientConfirmations.subjectType, "measurement_profile"), isNull(measurementProfiles.archivedAt), isNull(clients.archivedAt)));
  const fittingConfirmations = await db.select({ key: clientConfirmations.id, type: sql<string>`'Fitting confirmation'`, orderId: orders.id, label: orders.title, clientName: clients.fullName, createdAt: clientConfirmations.createdAt, expiresAt: clientConfirmations.expiresAt }).from(clientConfirmations).innerJoin(fittingSessions, eq(fittingSessions.id, clientConfirmations.subjectId)).innerJoin(orders, eq(orders.id, fittingSessions.orderId)).innerJoin(clients, eq(clients.id, orders.clientId)).where(and(activeConfirmation, eq(clientConfirmations.subjectType, "fitting_session"), isNull(fittingSessions.archivedAt), isNull(orders.archivedAt)));
  return [
    ...approvals.map((row) => ({ ...row, href: `/orders/${row.orderId}` })),
    ...orderConfirmations.map((row) => ({ ...row, href: `/orders/${row.orderId}` })),
    ...measurementConfirmations.map((row) => ({ ...row, href: `/clients/${row.clientId}` })),
    ...fittingConfirmations.map((row) => ({ ...row, href: `/orders/${row.orderId}/fittings` })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Every open Client to-do, including future work, with the closest due date first. */
export async function listOpenTodos(organizationId: string) {
  const db = getDatabase();
  const rows = await db
    .select({
      id: clientTasks.id,
      title: clientTasks.title,
      dueDate: clientTasks.dueDate,
      clientId: clientTasks.clientId,
      clientName: clients.fullName,
      assigneeName: staffProfiles.fullName,
    })
    .from(clientTasks)
    .innerJoin(clients, eq(clients.id, clientTasks.clientId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, clientTasks.assignedToStaffId))
    .where(
      and(
        eq(clientTasks.organizationId, organizationId),
        eq(clientTasks.status, "open"),
        isNull(clientTasks.archivedAt),
        isNull(clients.archivedAt),
      ),
    )
    .orderBy(asc(clientTasks.dueDate));

  return sortOpenTodosByDueDate(rows);
}

/** Convenience wrapper so the page resolves "today" once and passes it everywhere. */
export function dashboardToday(timezone: string, now = new Date()): BusinessDate {
  return toBusinessDate(now, timezone);
}
