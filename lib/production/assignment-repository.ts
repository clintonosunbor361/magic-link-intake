import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  items,
  itemTypes,
  productionStatusHistory,
  productionStatuses,
  vendorAssignments,
  vendors,
} from "@/db/schema";
import type { AssignmentRepository } from "@/lib/production/assignment-service";

export function createAssignmentRepository(): AssignmentRepository {
  const db = getDatabase();
  return {
    async itemBelongsToOrganization(organizationId, itemId) {
      const [row] = await db
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.organizationId, organizationId), eq(items.id, itemId), isNull(items.archivedAt)))
        .limit(1);
      return !!row;
    },
    async vendorIsAvailable(organizationId, vendorId) {
      const [row] = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(and(eq(vendors.organizationId, organizationId), eq(vendors.id, vendorId), isNull(vendors.archivedAt)))
        .limit(1);
      return !!row;
    },
    async getDefaultProductionStatusId(organizationId) {
      // The first live status by sort order is the starting point — "Not Started" in the seeded
      // list, but nothing here hardcodes that name.
      const [row] = await db
        .select({ id: productionStatuses.id })
        .from(productionStatuses)
        .where(and(eq(productionStatuses.organizationId, organizationId), isNull(productionStatuses.archivedAt)))
        .orderBy(asc(productionStatuses.sortOrder))
        .limit(1);
      return row?.id ?? null;
    },
    async getLiveAssignmentForItem(organizationId, itemId) {
      const [row] = await db
        .select({ id: vendorAssignments.id, version: vendorAssignments.version, itemId: vendorAssignments.itemId })
        .from(vendorAssignments)
        .where(
          and(
            eq(vendorAssignments.organizationId, organizationId),
            eq(vendorAssignments.itemId, itemId),
            isNull(vendorAssignments.archivedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async getAssignment(organizationId, assignmentId) {
      const [row] = await db
        .select({ id: vendorAssignments.id, version: vendorAssignments.version, itemId: vendorAssignments.itemId })
        .from(vendorAssignments)
        .where(and(eq(vendorAssignments.organizationId, organizationId), eq(vendorAssignments.id, assignmentId)))
        .limit(1);
      return row ?? null;
    },
    async listLookItemsForAssignment(organizationId, lookId) {
      const rows = await db
        .select({
          itemId: items.id,
          customLabel: items.customLabel,
          itemTypeName: itemTypes.name,
          currentVendorName: vendors.name,
        })
        .from(items)
        .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
        .leftJoin(
          vendorAssignments,
          and(eq(vendorAssignments.itemId, items.id), isNull(vendorAssignments.archivedAt)),
        )
        .leftJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
        .where(and(eq(items.organizationId, organizationId), eq(items.lookId, lookId), isNull(items.archivedAt)))
        .orderBy(asc(items.createdAt));

      return rows.map((row) => ({
        itemId: row.itemId,
        label: row.customLabel ?? row.itemTypeName,
        currentVendorName: row.currentVendorName,
      }));
    },
    async createAssignments(input) {
      // One transaction for the whole bulk: every Item gets its assignment and its opening
      // status-history row, or none does.
      return db.transaction(async (tx) => {
        const rows = await tx
          .insert(vendorAssignments)
          .values(
            input.itemIds.map((itemId) => ({
              organizationId: input.organizationId,
              itemId,
              vendorId: input.vendorId,
              productionStatusId: input.productionStatusId,
              deadline: input.deadline,
              agreedVendorCostMinor: input.agreedVendorCostMinor,
              assignedByStaffId: input.actorStaffId,
            })),
          )
          .returning({ id: vendorAssignments.id });

        await tx.insert(productionStatusHistory).values(
          rows.map((row) => ({
            organizationId: input.organizationId,
            vendorAssignmentId: row.id,
            previousStatusId: null,
            newStatusId: input.productionStatusId,
            note: null,
            changedByStaffId: input.actorStaffId,
          })),
        );

        return { ids: rows.map((row) => row.id) };
      });
    },
    async updateAssignmentTerms(input) {
      const rows = await db
        .update(vendorAssignments)
        .set({
          deadline: input.deadline,
          agreedVendorCostMinor: input.agreedVendorCostMinor,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorAssignments.organizationId, input.organizationId),
            eq(vendorAssignments.id, input.assignmentId),
            eq(vendorAssignments.version, input.expectedVersion),
          ),
        )
        .returning({ id: vendorAssignments.id });
      if (!rows.length) throw new Error("This assignment changed. Reload and try again.");
    },
    async replaceAssignment(input) {
      return db.transaction(async (tx) => {
        // Archiving first is what frees the partial unique index on (item_id) where archived_at is
        // null, so the replacement can be inserted. Both happen in one transaction, so the Item is
        // never left with zero or two live assignments.
        const archived = await tx
          .update(vendorAssignments)
          .set({ archivedAt: new Date(), version: input.nextVersion, updatedAt: new Date() })
          .where(
            and(
              eq(vendorAssignments.organizationId, input.organizationId),
              eq(vendorAssignments.id, input.assignmentId),
              eq(vendorAssignments.version, input.expectedVersion),
              isNull(vendorAssignments.archivedAt),
            ),
          )
          .returning({ id: vendorAssignments.id, vendorId: vendorAssignments.vendorId });
        if (!archived.length) throw new Error("This assignment changed. Reload and try again.");

        const [replacement] = await tx
          .insert(vendorAssignments)
          .values({
            organizationId: input.organizationId,
            itemId: input.itemId,
            vendorId: input.vendorId,
            productionStatusId: input.productionStatusId,
            deadline: input.deadline,
            agreedVendorCostMinor: input.agreedVendorCostMinor,
            assignedByStaffId: input.actorStaffId,
          })
          .returning({ id: vendorAssignments.id });

        await tx.insert(productionStatusHistory).values({
          organizationId: input.organizationId,
          vendorAssignmentId: replacement.id,
          previousStatusId: null,
          newStatusId: input.productionStatusId,
          note: null,
          changedByStaffId: input.actorStaffId,
        });

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "vendor_assignment.reassigned",
          entityType: "vendor_assignment",
          entityId: input.assignmentId,
          summary: `Reassigned this Item to another Vendor. Reason: ${input.reason}`,
          metadata: {
            previousAssignmentId: input.assignmentId,
            previousVendorId: archived[0].vendorId,
            replacementAssignmentId: replacement.id,
            newVendorId: input.vendorId,
          },
        });

        return { id: replacement.id };
      });
    },
  };
}

export type AssignmentDetail = {
  id: string;
  itemId: string;
  version: number;
  vendorId: string;
  vendorName: string;
  vendorPhone: string | null;
  vendorEmail: string | null;
  deadline: string;
  agreedVendorCostMinor: number | null;
  productionStatusId: string;
  productionStatusName: string;
  productionStatusIsCompleted: boolean;
  briefLastExportedAt: Date | null;
};

export async function getLiveAssignmentDetailForItem(
  organizationId: string,
  itemId: string,
): Promise<AssignmentDetail | null> {
  const db = getDatabase();
  const [row] = await db
    .select({
      id: vendorAssignments.id,
      itemId: vendorAssignments.itemId,
      version: vendorAssignments.version,
      vendorId: vendors.id,
      vendorName: vendors.name,
      vendorPhone: vendors.phone,
      vendorEmail: vendors.email,
      deadline: vendorAssignments.deadline,
      agreedVendorCostMinor: vendorAssignments.agreedVendorCostMinor,
      productionStatusId: productionStatuses.id,
      productionStatusName: productionStatuses.name,
      productionStatusIsCompleted: productionStatuses.isCompleted,
      briefLastExportedAt: vendorAssignments.briefLastExportedAt,
    })
    .from(vendorAssignments)
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
    .where(
      and(
        eq(vendorAssignments.organizationId, organizationId),
        eq(vendorAssignments.itemId, itemId),
        isNull(vendorAssignments.archivedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getAssignmentDetail(
  organizationId: string,
  assignmentId: string,
): Promise<AssignmentDetail | null> {
  const db = getDatabase();
  const [row] = await db
    .select({
      id: vendorAssignments.id,
      itemId: vendorAssignments.itemId,
      version: vendorAssignments.version,
      vendorId: vendors.id,
      vendorName: vendors.name,
      vendorPhone: vendors.phone,
      vendorEmail: vendors.email,
      deadline: vendorAssignments.deadline,
      agreedVendorCostMinor: vendorAssignments.agreedVendorCostMinor,
      productionStatusId: productionStatuses.id,
      productionStatusName: productionStatuses.name,
      productionStatusIsCompleted: productionStatuses.isCompleted,
      briefLastExportedAt: vendorAssignments.briefLastExportedAt,
    })
    .from(vendorAssignments)
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
    .where(and(eq(vendorAssignments.organizationId, organizationId), eq(vendorAssignments.id, assignmentId)))
    .limit(1);

  return row ?? null;
}

export async function countLiveAssignmentsForLook(organizationId: string, lookId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorAssignments)
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .where(
      and(
        eq(vendorAssignments.organizationId, organizationId),
        eq(items.lookId, lookId),
        isNull(vendorAssignments.archivedAt),
      ),
    );
  return row?.count ?? 0;
}
