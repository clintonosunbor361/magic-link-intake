import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { accessoryTypes } from "@/db/schema";
import type { AccessoryTypeRepository } from "@/lib/accessory-types/service";

export function createAccessoryTypeRepository(): AccessoryTypeRepository {
  const db = getDatabase();
  return {
    async createAccessoryType(input) {
      const [row] = await db
        .insert(accessoryTypes)
        .values({ organizationId: input.organizationId, name: input.name, sortOrder: input.sortOrder })
        .returning({ id: accessoryTypes.id });
      return row;
    },
    async getAccessoryType(organizationId, accessoryTypeId) {
      const [row] = await db
        .select({ id: accessoryTypes.id, version: accessoryTypes.version })
        .from(accessoryTypes)
        .where(and(eq(accessoryTypes.organizationId, organizationId), eq(accessoryTypes.id, accessoryTypeId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(accessoryTypes)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accessoryTypes.organizationId, input.organizationId),
            eq(accessoryTypes.id, input.accessoryTypeId),
            eq(accessoryTypes.version, input.expectedVersion),
          ),
        )
        .returning({ id: accessoryTypes.id });
      if (!rows.length) throw new Error("This accessory type changed. Reload and try again.");
    },
  };
}

export async function listAccessoryTypes(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(accessoryTypes.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(accessoryTypes.archivedAt));

  return db
    .select({
      id: accessoryTypes.id,
      name: accessoryTypes.name,
      sortOrder: accessoryTypes.sortOrder,
      version: accessoryTypes.version,
      archivedAt: accessoryTypes.archivedAt,
    })
    .from(accessoryTypes)
    .where(and(...conditions))
    .orderBy(asc(accessoryTypes.sortOrder));
}
