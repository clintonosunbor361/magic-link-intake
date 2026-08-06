import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { measurementFieldDefinitions } from "@/db/schema";
import type { MeasurementFieldDefinitionRepository } from "@/lib/measurement-field-definitions/service";

export function createMeasurementFieldDefinitionRepository(): MeasurementFieldDefinitionRepository {
  const db = getDatabase();
  return {
    async createMeasurementFieldDefinition(input) {
      const [row] = await db
        .insert(measurementFieldDefinitions)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          unit: input.unit,
          sortOrder: input.sortOrder,
        })
        .returning({ id: measurementFieldDefinitions.id });
      return row;
    },
    async getMeasurementFieldDefinition(organizationId, fieldDefinitionId) {
      const [row] = await db
        .select({ id: measurementFieldDefinitions.id, version: measurementFieldDefinitions.version })
        .from(measurementFieldDefinitions)
        .where(
          and(
            eq(measurementFieldDefinitions.organizationId, organizationId),
            eq(measurementFieldDefinitions.id, fieldDefinitionId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(measurementFieldDefinitions)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(measurementFieldDefinitions.organizationId, input.organizationId),
            eq(measurementFieldDefinitions.id, input.fieldDefinitionId),
            eq(measurementFieldDefinitions.version, input.expectedVersion),
          ),
        )
        .returning({ id: measurementFieldDefinitions.id });
      if (!rows.length) throw new Error("This measurement field changed. Reload and try again.");
    },
  };
}

export async function listMeasurementFieldDefinitions(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(measurementFieldDefinitions.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(measurementFieldDefinitions.archivedAt));

  return db
    .select({
      id: measurementFieldDefinitions.id,
      name: measurementFieldDefinitions.name,
      unit: measurementFieldDefinitions.unit,
      sortOrder: measurementFieldDefinitions.sortOrder,
      version: measurementFieldDefinitions.version,
      archivedAt: measurementFieldDefinitions.archivedAt,
    })
    .from(measurementFieldDefinitions)
    .where(and(...conditions))
    .orderBy(measurementFieldDefinitions.sortOrder);
}
