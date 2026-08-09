import "server-only";

import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { accessoryStatuses } from "@/db/schema";
import type { AccessoryStatusRepository } from "@/lib/accessory-statuses/service";

export function createAccessoryStatusRepository(): AccessoryStatusRepository {
  const db = getDatabase();
  return {
    async createAccessoryStatus(input) {
      const [row] = await db
        .insert(accessoryStatuses)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          sortOrder: input.sortOrder,
          isCompleted: input.isCompleted,
        })
        .returning({ id: accessoryStatuses.id });
      return row;
    },
    async getAccessoryStatus(organizationId, statusId) {
      const [row] = await db
        .select({
          id: accessoryStatuses.id,
          version: accessoryStatuses.version,
          isCompleted: accessoryStatuses.isCompleted,
        })
        .from(accessoryStatuses)
        .where(and(eq(accessoryStatuses.organizationId, organizationId), eq(accessoryStatuses.id, statusId)))
        .limit(1);
      return row ?? null;
    },
    async countOtherLiveCompletedStatuses(organizationId, excludingStatusId) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accessoryStatuses)
        .where(
          and(
            eq(accessoryStatuses.organizationId, organizationId),
            ne(accessoryStatuses.id, excludingStatusId),
            eq(accessoryStatuses.isCompleted, true),
            isNull(accessoryStatuses.archivedAt),
          ),
        );
      return row?.count ?? 0;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(accessoryStatuses)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accessoryStatuses.organizationId, input.organizationId),
            eq(accessoryStatuses.id, input.statusId),
            eq(accessoryStatuses.version, input.expectedVersion),
          ),
        )
        .returning({ id: accessoryStatuses.id });
      if (!rows.length) throw new Error("This accessory status changed. Reload and try again.");
    },
    async setCompletedSemantics(input) {
      const rows = await db
        .update(accessoryStatuses)
        .set({
          isCompleted: input.isCompleted,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accessoryStatuses.organizationId, input.organizationId),
            eq(accessoryStatuses.id, input.statusId),
            eq(accessoryStatuses.version, input.expectedVersion),
          ),
        )
        .returning({ id: accessoryStatuses.id });
      if (!rows.length) throw new Error("This accessory status changed. Reload and try again.");
    },
  };
}

export async function listAccessoryStatuses(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(accessoryStatuses.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(accessoryStatuses.archivedAt));

  return db
    .select({
      id: accessoryStatuses.id,
      name: accessoryStatuses.name,
      sortOrder: accessoryStatuses.sortOrder,
      isCompleted: accessoryStatuses.isCompleted,
      version: accessoryStatuses.version,
      archivedAt: accessoryStatuses.archivedAt,
    })
    .from(accessoryStatuses)
    .where(and(...conditions))
    .orderBy(asc(accessoryStatuses.sortOrder));
}
