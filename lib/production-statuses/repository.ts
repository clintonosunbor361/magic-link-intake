import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { productionStatuses } from "@/db/schema";
import type { ProductionStatusRepository } from "@/lib/production-statuses/service";

export function createProductionStatusRepository(): ProductionStatusRepository {
  const db = getDatabase();
  return {
    async createProductionStatus(input) {
      const [row] = await db
        .insert(productionStatuses)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          sortOrder: input.sortOrder,
          isCompleted: input.isCompleted,
        })
        .returning({ id: productionStatuses.id });
      return row;
    },
    async getProductionStatus(organizationId, statusId) {
      const [row] = await db
        .select({
          id: productionStatuses.id,
          version: productionStatuses.version,
          isCompleted: productionStatuses.isCompleted,
        })
        .from(productionStatuses)
        .where(and(eq(productionStatuses.organizationId, organizationId), eq(productionStatuses.id, statusId)))
        .limit(1);
      return row ?? null;
    },
    async countOtherLiveCompletedStatuses(organizationId, excludingStatusId) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(productionStatuses)
        .where(
          and(
            eq(productionStatuses.organizationId, organizationId),
            ne(productionStatuses.id, excludingStatusId),
            eq(productionStatuses.isCompleted, true),
            isNull(productionStatuses.archivedAt),
          ),
        );
      return row?.count ?? 0;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(productionStatuses)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productionStatuses.organizationId, input.organizationId),
            eq(productionStatuses.id, input.statusId),
            eq(productionStatuses.version, input.expectedVersion),
          ),
        )
        .returning({ id: productionStatuses.id });
      if (!rows.length) throw new Error("This production status changed. Reload and try again.");
    },
    async setCompletedSemantics(input) {
      const rows = await db
        .update(productionStatuses)
        .set({
          isCompleted: input.isCompleted,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productionStatuses.organizationId, input.organizationId),
            eq(productionStatuses.id, input.statusId),
            eq(productionStatuses.version, input.expectedVersion),
          ),
        )
        .returning({ id: productionStatuses.id });
      if (!rows.length) throw new Error("This production status changed. Reload and try again.");
    },
  };
}

export async function listProductionStatuses(
  organizationId: string,
  options: { includeArchived?: boolean } = {},
) {
  const db = getDatabase();
  const conditions = [eq(productionStatuses.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(productionStatuses.archivedAt));

  return db
    .select({
      id: productionStatuses.id,
      name: productionStatuses.name,
      sortOrder: productionStatuses.sortOrder,
      isCompleted: productionStatuses.isCompleted,
      version: productionStatuses.version,
      archivedAt: productionStatuses.archivedAt,
    })
    .from(productionStatuses)
    .where(and(...conditions))
    .orderBy(productionStatuses.sortOrder);
}
