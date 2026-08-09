import "server-only";

import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  clients,
  enquiries,
  enquiryTasks,
  fittingSessions,
  items,
  itemTypes,
  looks,
  orders,
  productionStatuses,
  staffProfiles,
  styleDirectionFiles,
  vendorAssignments,
  vendors,
} from "@/db/schema";
import { type BusinessDate, toBusinessDate } from "@/lib/domain/business-date";
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

/** Style Direction files awaiting a client decision, across every Order. */
export async function listPendingApprovals(organizationId: string) {
  const db = getDatabase();
  return db
    .select({
      fileId: styleDirectionFiles.id,
      category: styleDirectionFiles.category,
      orderId: orders.id,
      orderTitle: orders.title,
      clientName: clients.fullName,
      updatedAt: styleDirectionFiles.updatedAt,
    })
    .from(styleDirectionFiles)
    .innerJoin(orders, eq(orders.id, styleDirectionFiles.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(
      and(
        eq(styleDirectionFiles.organizationId, organizationId),
        eq(styleDirectionFiles.requiresClientApproval, true),
        eq(styleDirectionFiles.approvalStatus, "pending"),
        isNull(styleDirectionFiles.archivedAt),
        isNull(orders.archivedAt),
      ),
    )
    .orderBy(asc(styleDirectionFiles.updatedAt));
}

/** Open follow-up to-dos, due or overdue as of today. */
export async function listDueFollowUps(organizationId: string, today: BusinessDate) {
  const db = getDatabase();
  return db
    .select({
      id: enquiryTasks.id,
      title: enquiryTasks.title,
      dueDate: enquiryTasks.dueDate,
      enquiryId: enquiryTasks.enquiryId,
      enquiryName: enquiries.fullName,
      assigneeName: staffProfiles.fullName,
    })
    .from(enquiryTasks)
    .innerJoin(enquiries, eq(enquiries.id, enquiryTasks.enquiryId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, enquiryTasks.assignedToStaffId))
    .where(
      and(
        eq(enquiryTasks.organizationId, organizationId),
        eq(enquiryTasks.status, "open"),
        isNull(enquiryTasks.archivedAt),
        isNull(enquiries.archivedAt),
        lte(enquiryTasks.dueDate, today),
      ),
    )
    .orderBy(asc(enquiryTasks.dueDate));
}

/** Convenience wrapper so the page resolves "today" once and passes it everywhere. */
export function dashboardToday(timezone: string, now = new Date()): BusinessDate {
  return toBusinessDate(now, timezone);
}
