import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  itemTypeMeasurementRequirements,
  itemTypes,
  items,
  looks,
  measurementFieldDefinitions,
  measurementProfiles,
  measurementValues,
  orders,
} from "@/db/schema";
import { computeMissingFieldIds } from "@/lib/item-type-measurement-requirements/rules";
import type { MeasurementRequirementRepository } from "@/lib/item-type-measurement-requirements/service";

export function createMeasurementRequirementRepository(): MeasurementRequirementRepository {
  const db = getDatabase();
  return {
    async itemTypeBelongsToOrganization(organizationId, itemTypeId) {
      const [row] = await db
        .select({ id: itemTypes.id })
        .from(itemTypes)
        .where(and(eq(itemTypes.organizationId, organizationId), eq(itemTypes.id, itemTypeId)))
        .limit(1);
      return !!row;
    },
    async fieldDefinitionBelongsToOrganization(organizationId, fieldDefinitionId) {
      const [row] = await db
        .select({ id: measurementFieldDefinitions.id })
        .from(measurementFieldDefinitions)
        .where(
          and(
            eq(measurementFieldDefinitions.organizationId, organizationId),
            eq(measurementFieldDefinitions.id, fieldDefinitionId),
          ),
        )
        .limit(1);
      return !!row;
    },
    async createRequirement(input) {
      const [row] = await db
        .insert(itemTypeMeasurementRequirements)
        .values({
          organizationId: input.organizationId,
          itemTypeId: input.itemTypeId,
          fieldDefinitionId: input.fieldDefinitionId,
        })
        .returning({ id: itemTypeMeasurementRequirements.id });
      return row;
    },
    async getRequirementLifecycle(organizationId, requirementId) {
      const [row] = await db
        .select({ id: itemTypeMeasurementRequirements.id, version: itemTypeMeasurementRequirements.version })
        .from(itemTypeMeasurementRequirements)
        .where(
          and(
            eq(itemTypeMeasurementRequirements.organizationId, organizationId),
            eq(itemTypeMeasurementRequirements.id, requirementId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(itemTypeMeasurementRequirements)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(itemTypeMeasurementRequirements.organizationId, input.organizationId),
            eq(itemTypeMeasurementRequirements.id, input.requirementId),
            eq(itemTypeMeasurementRequirements.version, input.expectedVersion),
          ),
        )
        .returning({ id: itemTypeMeasurementRequirements.id });
      if (!rows.length) throw new Error("This measurement requirement changed. Reload and try again.");
    },
  };
}

export async function listMeasurementRequirements(organizationId: string, options: { includeArchived?: boolean } = {}) {
  const db = getDatabase();
  const conditions = [eq(itemTypeMeasurementRequirements.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(itemTypeMeasurementRequirements.archivedAt));

  return db
    .select({
      id: itemTypeMeasurementRequirements.id,
      itemTypeId: itemTypeMeasurementRequirements.itemTypeId,
      fieldDefinitionId: itemTypeMeasurementRequirements.fieldDefinitionId,
      version: itemTypeMeasurementRequirements.version,
      archivedAt: itemTypeMeasurementRequirements.archivedAt,
    })
    .from(itemTypeMeasurementRequirements)
    .where(and(...conditions));
}

export type MissingMeasurement = { fieldId: string; fieldName: string };

// Batched once per Order page render (no N+1): one query for the order's client's present
// fields, one for the order's items' types, one for those types' required fields.
export async function getMissingMeasurementsForOrder(
  organizationId: string,
  orderId: string,
): Promise<Map<string, MissingMeasurement[]>> {
  const db = getDatabase();

  const [order] = await db
    .select({ clientId: orders.clientId })
    .from(orders)
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) return new Map();

  const [profile] = await db
    .select({ id: measurementProfiles.id })
    .from(measurementProfiles)
    .where(and(eq(measurementProfiles.organizationId, organizationId), eq(measurementProfiles.clientId, order.clientId)))
    .limit(1);

  const presentFieldIds = profile
    ? (
        await db
          .select({ fieldDefinitionId: measurementValues.fieldDefinitionId })
          .from(measurementValues)
          .where(and(eq(measurementValues.organizationId, organizationId), eq(measurementValues.measurementProfileId, profile.id)))
      ).map((row) => row.fieldDefinitionId)
    : [];

  const itemRows = await db
    .select({ itemId: items.id, itemTypeId: items.itemTypeId })
    .from(items)
    .innerJoin(looks, eq(looks.id, items.lookId))
    .where(and(eq(items.organizationId, organizationId), eq(looks.orderId, orderId)));
  if (!itemRows.length) return new Map();

  const itemTypeIds = [...new Set(itemRows.map((row) => row.itemTypeId))];

  const requirementRows = await db
    .select({
      itemTypeId: itemTypeMeasurementRequirements.itemTypeId,
      fieldId: measurementFieldDefinitions.id,
      fieldName: measurementFieldDefinitions.name,
    })
    .from(itemTypeMeasurementRequirements)
    .innerJoin(measurementFieldDefinitions, eq(measurementFieldDefinitions.id, itemTypeMeasurementRequirements.fieldDefinitionId))
    .where(
      and(
        eq(itemTypeMeasurementRequirements.organizationId, organizationId),
        inArray(itemTypeMeasurementRequirements.itemTypeId, itemTypeIds),
        isNull(itemTypeMeasurementRequirements.archivedAt),
      ),
    );

  const requiredByItemType = new Map<string, MissingMeasurement[]>();
  for (const row of requirementRows) {
    const list = requiredByItemType.get(row.itemTypeId) ?? [];
    list.push({ fieldId: row.fieldId, fieldName: row.fieldName });
    requiredByItemType.set(row.itemTypeId, list);
  }

  const missingByItemId = new Map<string, MissingMeasurement[]>();
  for (const item of itemRows) {
    const required = requiredByItemType.get(item.itemTypeId) ?? [];
    const missingIds = new Set(computeMissingFieldIds(required.map((field) => field.fieldId), presentFieldIds));
    const missing = required.filter((field) => missingIds.has(field.fieldId));
    if (missing.length) missingByItemId.set(item.itemId, missing);
  }

  return missingByItemId;
}
