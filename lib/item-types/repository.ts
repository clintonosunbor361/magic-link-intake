import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { itemTypes } from "@/db/schema";
import type { ItemTypeRepository } from "@/lib/item-types/service";

export function createItemTypeRepository(): ItemTypeRepository {
  const db = getDatabase();
  return {
    async createItemType(input) {
      const [row] = await db
        .insert(itemTypes)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          sortOrder: input.sortOrder,
        })
        .returning({ id: itemTypes.id });
      return row;
    },
    async getItemType(organizationId, itemTypeId) {
      const [row] = await db
        .select({ id: itemTypes.id, version: itemTypes.version })
        .from(itemTypes)
        .where(and(eq(itemTypes.organizationId, organizationId), eq(itemTypes.id, itemTypeId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(itemTypes)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(itemTypes.organizationId, input.organizationId),
            eq(itemTypes.id, input.itemTypeId),
            eq(itemTypes.version, input.expectedVersion),
          ),
        )
        .returning({ id: itemTypes.id });
      if (!rows.length) throw new Error("This Item Type changed. Reload and try again.");
    },
  };
}

export async function listItemTypes(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(itemTypes.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(itemTypes.archivedAt));

  return db
    .select({
      id: itemTypes.id,
      name: itemTypes.name,
      sortOrder: itemTypes.sortOrder,
      version: itemTypes.version,
      archivedAt: itemTypes.archivedAt,
    })
    .from(itemTypes)
    .where(and(...conditions))
    .orderBy(itemTypes.sortOrder);
}
