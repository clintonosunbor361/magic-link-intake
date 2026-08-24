import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { leadSources } from "@/db/schema";
import type { LeadSourceRepository } from "@/lib/lead-sources/service";

export function createLeadSourceRepository(): LeadSourceRepository {
  const db = getDatabase();
  return {
    async createLeadSource(input) {
      const [row] = await db
        .insert(leadSources)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          sortOrder: input.sortOrder,
        })
        .returning({ id: leadSources.id });
      return row;
    },
    async getLeadSource(organizationId, leadSourceId) {
      const [row] = await db
        .select({ id: leadSources.id, version: leadSources.version })
        .from(leadSources)
        .where(and(eq(leadSources.organizationId, organizationId), eq(leadSources.id, leadSourceId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(leadSources)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leadSources.organizationId, input.organizationId),
            eq(leadSources.id, input.leadSourceId),
            eq(leadSources.version, input.expectedVersion),
          ),
        )
        .returning({ id: leadSources.id });
      if (!rows.length) throw new Error("This Lead Source changed. Reload and try again.");
    },
  };
}

export async function listLeadSources(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(leadSources.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(leadSources.archivedAt));

  return db
    .select({
      id: leadSources.id,
      name: leadSources.name,
      sortOrder: leadSources.sortOrder,
      version: leadSources.version,
      archivedAt: leadSources.archivedAt,
    })
    .from(leadSources)
    .where(and(...conditions))
    .orderBy(leadSources.sortOrder);
}
