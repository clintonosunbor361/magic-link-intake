import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { consultationNoteSources } from "@/db/schema";
import type { ConsultationNoteSourceRepository } from "@/lib/consultation-note-sources/service";

export function createConsultationNoteSourceRepository(): ConsultationNoteSourceRepository {
  const db = getDatabase();
  return {
    async createConsultationNoteSource(input) {
      const [row] = await db
        .insert(consultationNoteSources)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          sortOrder: input.sortOrder,
        })
        .returning({ id: consultationNoteSources.id });
      return row;
    },
    async getConsultationNoteSource(organizationId, sourceId) {
      const [row] = await db
        .select({ id: consultationNoteSources.id, version: consultationNoteSources.version })
        .from(consultationNoteSources)
        .where(and(eq(consultationNoteSources.organizationId, organizationId), eq(consultationNoteSources.id, sourceId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(consultationNoteSources)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(consultationNoteSources.organizationId, input.organizationId),
            eq(consultationNoteSources.id, input.sourceId),
            eq(consultationNoteSources.version, input.expectedVersion),
          ),
        )
        .returning({ id: consultationNoteSources.id });
      if (!rows.length) throw new Error("This Source changed. Reload and try again.");
    },
  };
}

export async function listConsultationNoteSources(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(consultationNoteSources.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(consultationNoteSources.archivedAt));

  return db
    .select({
      id: consultationNoteSources.id,
      name: consultationNoteSources.name,
      sortOrder: consultationNoteSources.sortOrder,
      version: consultationNoteSources.version,
      archivedAt: consultationNoteSources.archivedAt,
    })
    .from(consultationNoteSources)
    .where(and(...conditions))
    .orderBy(consultationNoteSources.sortOrder);
}
