import "server-only";

import { and, asc, eq, isNull, lt, sql, type SQL } from "drizzle-orm";
import { getDatabase } from "@/db";
import { clients, items, itemTypes, looks, orders, productionStatuses, vendorAssignments, vendors } from "@/db/schema";
import { computeOrderBalance, computeVendorPaymentPosition, type OrderBalance, type VendorPaymentPosition } from "@/lib/finance/balances";
import { describeUrgency, type UrgencyDescriptor } from "@/lib/production/urgency";

export type ProductionFilters = {
  vendorId?: string;
  statusId?: string;
  clientId?: string;
  dueBefore?: string;
  overdueOnly?: boolean;
};

export type ProductionItemRow = {
  assignmentId: string;
  // Carried into the row so the inline status control can post an accurate expected version;
  // a placeholder here would make every quick status change fail the optimistic check.
  assignmentVersion: number;
  itemId: string;
  itemLabel: string;
  quantity: number;
  vendorId: string;
  vendorName: string;
  statusId: string;
  statusName: string;
  statusIsCompleted: boolean;
  deadline: string;
  urgency: UrgencyDescriptor;
  vendorPosition: VendorPaymentPosition;
  hasBriefExport: boolean;
};

export type ProductionLookGroup = {
  lookId: string;
  lookName: string;
  items: ProductionItemRow[];
};

export type ProductionOrderGroup = {
  orderId: string;
  orderTitle: string;
  clientId: string;
  clientName: string;
  orderBalance: OrderBalance;
  looks: ProductionLookGroup[];
};

export type ProductionClientGroup = {
  clientId: string;
  clientName: string;
  orders: ProductionOrderGroup[];
};

/**
 * The grouped Client -> Order -> Look -> Item production view.
 *
 * Grouping is assembled in application code from one flat, ordered query rather than four nested
 * ones: at Phase 1 volume that is a single round-trip, and it keeps "which groups survive the
 * filters" trivially correct — a group exists precisely when it still contains a matching Item.
 *
 * Archived assignments are excluded entirely. They are the residue of a reassignment: that work now
 * belongs to a different Vendor, and showing both would double-count the Item.
 */
export async function listProductionWorkspace(input: {
  organizationId: string;
  today: string;
  filters?: ProductionFilters;
}): Promise<ProductionClientGroup[]> {
  const db = getDatabase();
  const filters = input.filters ?? {};

  const conditions: SQL[] = [
    eq(vendorAssignments.organizationId, input.organizationId),
    isNull(vendorAssignments.archivedAt),
    // Archiving a parent hides its dependents (ARCHIVE_CASCADE is visibility-only), so an archived
    // Item, Look, Order or Client takes its production rows out of the workspace with it.
    isNull(items.archivedAt),
    isNull(looks.archivedAt),
    isNull(orders.archivedAt),
    isNull(clients.archivedAt),
  ];
  if (filters.vendorId) conditions.push(eq(vendorAssignments.vendorId, filters.vendorId));
  if (filters.statusId) conditions.push(eq(vendorAssignments.productionStatusId, filters.statusId));
  if (filters.clientId) conditions.push(eq(clients.id, filters.clientId));
  if (filters.dueBefore) conditions.push(lt(vendorAssignments.deadline, filters.dueBefore));
  // "Overdue" is evaluated against the organization's business date, the same value the badge is
  // computed from, so the filter and the badge can never disagree.
  if (filters.overdueOnly) conditions.push(lt(vendorAssignments.deadline, input.today));

  const rows = await db
    .select({
      assignmentId: vendorAssignments.id,
      assignmentVersion: vendorAssignments.version,
      deadline: vendorAssignments.deadline,
      agreedVendorCostMinor: vendorAssignments.agreedVendorCostMinor,
      briefLastExportedAt: vendorAssignments.briefLastExportedAt,
      itemId: items.id,
      customLabel: items.customLabel,
      quantity: items.quantity,
      itemTypeName: itemTypes.name,
      lookId: looks.id,
      lookName: looks.name,
      orderId: orders.id,
      orderTitle: orders.title,
      clientId: clients.id,
      clientName: clients.fullName,
      vendorId: vendors.id,
      vendorName: vendors.name,
      statusId: productionStatuses.id,
      statusName: productionStatuses.name,
      statusIsCompleted: productionStatuses.isCompleted,
    })
    .from(vendorAssignments)
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
    .where(and(...conditions))
    .orderBy(
      asc(clients.fullName),
      asc(orders.createdAt),
      asc(looks.createdAt),
      asc(vendorAssignments.deadline),
      asc(items.createdAt),
    );

  const clientGroups = new Map<string, ProductionClientGroup>();

  for (const row of rows) {
    const clientGroup = ensure(clientGroups, row.clientId, () => ({
      clientId: row.clientId,
      clientName: row.clientName,
      orders: [],
    }));

    let orderGroup = clientGroup.orders.find((group) => group.orderId === row.orderId);
    if (!orderGroup) {
      orderGroup = {
        orderId: row.orderId,
        orderTitle: row.orderTitle,
        clientId: row.clientId,
        clientName: row.clientName,
        // Milestone 5 has no invoices or client payments, so this reports "not invoiced" rather
        // than a balance of zero. Milestone 6 supplies the real figures to the same function.
        orderBalance: computeOrderBalance({ invoicedMinor: null, paidMinor: 0 }),
        looks: [],
      };
      clientGroup.orders.push(orderGroup);
    }

    let lookGroup = orderGroup.looks.find((group) => group.lookId === row.lookId);
    if (!lookGroup) {
      lookGroup = { lookId: row.lookId, lookName: row.lookName, items: [] };
      orderGroup.looks.push(lookGroup);
    }

    lookGroup.items.push({
      assignmentId: row.assignmentId,
      assignmentVersion: row.assignmentVersion,
      itemId: row.itemId,
      itemLabel: row.customLabel ?? row.itemTypeName,
      quantity: row.quantity,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      statusId: row.statusId,
      statusName: row.statusName,
      statusIsCompleted: row.statusIsCompleted,
      deadline: row.deadline,
      urgency: describeUrgency({ deadline: row.deadline, today: input.today }),
      // Vendor payment records arrive in Milestone 6; until then this is the agreed cost with
      // nothing paid against it, and the UI says so rather than printing "₦0 paid".
      vendorPosition: computeVendorPaymentPosition({
        agreedCostMinor: row.agreedVendorCostMinor,
        paidMinor: 0,
      }),
      hasBriefExport: row.briefLastExportedAt !== null,
    });
  }

  return [...clientGroups.values()];
}

function ensure<T>(map: Map<string, T>, key: string, create: () => T): T {
  const existing = map.get(key);
  if (existing) return existing;
  const created = create();
  map.set(key, created);
  return created;
}

export async function countLiveAssignments(organizationId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorAssignments)
    .where(and(eq(vendorAssignments.organizationId, organizationId), isNull(vendorAssignments.archivedAt)));
  return row?.count ?? 0;
}
