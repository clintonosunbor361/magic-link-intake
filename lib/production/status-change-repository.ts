import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  productionNotes,
  productionStatusHistory,
  productionStatuses,
  staffProfiles,
  vendorAssignments,
} from "@/db/schema";
import type {
  ProductionNoteRepository,
  ProductionStatusChangeRepository,
} from "@/lib/production/status-change-service";

export function createProductionStatusChangeRepository(): ProductionStatusChangeRepository {
  const db = getDatabase();
  return {
    async getAssignmentStatus(organizationId, assignmentId) {
      const [row] = await db
        .select({
          id: vendorAssignments.id,
          version: vendorAssignments.version,
          productionStatusId: vendorAssignments.productionStatusId,
        })
        .from(vendorAssignments)
        .where(
          and(
            eq(vendorAssignments.organizationId, organizationId),
            eq(vendorAssignments.id, assignmentId),
            isNull(vendorAssignments.archivedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async statusIsSelectable(organizationId, statusId) {
      const [row] = await db
        .select({ id: productionStatuses.id })
        .from(productionStatuses)
        .where(
          and(
            eq(productionStatuses.organizationId, organizationId),
            eq(productionStatuses.id, statusId),
            isNull(productionStatuses.archivedAt),
          ),
        )
        .limit(1);
      return !!row;
    },
    async applyStatusChange(input) {
      // The status move and its history row are one transaction: a status can never change without
      // leaving evidence of who changed it and from what.
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(vendorAssignments)
          .set({
            productionStatusId: input.newStatusId,
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

        await tx.insert(productionStatusHistory).values({
          organizationId: input.organizationId,
          vendorAssignmentId: input.assignmentId,
          previousStatusId: input.previousStatusId,
          newStatusId: input.newStatusId,
          note: input.note,
          changedByStaffId: input.actorStaffId,
        });
      });
    },
  };
}

export function createProductionNoteRepository(): ProductionNoteRepository {
  const db = getDatabase();
  return {
    async assignmentBelongsToOrganization(organizationId, assignmentId) {
      const [row] = await db
        .select({ id: vendorAssignments.id })
        .from(vendorAssignments)
        .where(and(eq(vendorAssignments.organizationId, organizationId), eq(vendorAssignments.id, assignmentId)))
        .limit(1);
      return !!row;
    },
    async createProductionNote(input) {
      const [row] = await db
        .insert(productionNotes)
        .values({
          organizationId: input.organizationId,
          vendorAssignmentId: input.assignmentId,
          note: input.note,
          createdByStaffId: input.actorStaffId,
        })
        .returning({ id: productionNotes.id });
      return row;
    },
  };
}

export async function listStatusHistory(organizationId: string, assignmentId: string) {
  const db = getDatabase();
  const previousStatus = productionStatuses;
  const newStatus = productionStatuses;

  const rows = await db
    .select({
      id: productionStatusHistory.id,
      previousStatusId: productionStatusHistory.previousStatusId,
      newStatusId: productionStatusHistory.newStatusId,
      note: productionStatusHistory.note,
      createdAt: productionStatusHistory.createdAt,
      changedByName: staffProfiles.fullName,
    })
    .from(productionStatusHistory)
    .innerJoin(staffProfiles, eq(staffProfiles.id, productionStatusHistory.changedByStaffId))
    .where(
      and(
        eq(productionStatusHistory.organizationId, organizationId),
        eq(productionStatusHistory.vendorAssignmentId, assignmentId),
      ),
    )
    .orderBy(desc(productionStatusHistory.createdAt));

  // Status names are resolved separately so an archived status still renders its real name rather
  // than dropping the history row through an inner join.
  const statusRows = await db
    .select({ id: previousStatus.id, name: newStatus.name })
    .from(productionStatuses)
    .where(eq(productionStatuses.organizationId, organizationId));
  const names = new Map(statusRows.map((row) => [row.id, row.name]));

  return rows.map((row) => ({
    id: row.id,
    previousStatusName: row.previousStatusId ? (names.get(row.previousStatusId) ?? "Unknown") : null,
    newStatusName: names.get(row.newStatusId) ?? "Unknown",
    note: row.note,
    createdAt: row.createdAt,
    changedByName: row.changedByName,
  }));
}

export async function listProductionNotes(organizationId: string, assignmentId: string) {
  const db = getDatabase();
  return db
    .select({
      id: productionNotes.id,
      note: productionNotes.note,
      createdAt: productionNotes.createdAt,
      createdByName: staffProfiles.fullName,
    })
    .from(productionNotes)
    .innerJoin(staffProfiles, eq(staffProfiles.id, productionNotes.createdByStaffId))
    .where(
      and(
        eq(productionNotes.organizationId, organizationId),
        eq(productionNotes.vendorAssignmentId, assignmentId),
      ),
    )
    .orderBy(desc(productionNotes.createdAt));
}
