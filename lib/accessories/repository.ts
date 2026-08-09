import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { accessoryItems, accessoryStatuses, accessoryTypes, looks, orders } from "@/db/schema";
import type { AccessoryItemRepository } from "@/lib/accessories/service";
import {
  type AccessoryDeliveryDate,
  type LookDateSource,
  resolveAccessoryDeliveryDate,
} from "@/lib/accessories/delivery-date";

export function createAccessoryItemRepository(): AccessoryItemRepository {
  const db = getDatabase();
  return {
    async orderBelongsToOrganization(organizationId, orderId) {
      const [row] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
        .limit(1);
      return !!row;
    },
    async lookBelongsToOrder(organizationId, orderId, lookId) {
      const [row] = await db
        .select({ id: looks.id })
        .from(looks)
        .where(and(eq(looks.organizationId, organizationId), eq(looks.orderId, orderId), eq(looks.id, lookId)))
        .limit(1);
      return !!row;
    },
    async typeIsSelectable(organizationId, accessoryTypeId) {
      const [row] = await db
        .select({ id: accessoryTypes.id })
        .from(accessoryTypes)
        .where(
          and(
            eq(accessoryTypes.organizationId, organizationId),
            eq(accessoryTypes.id, accessoryTypeId),
            isNull(accessoryTypes.archivedAt),
          ),
        )
        .limit(1);
      return !!row;
    },
    async statusIsSelectable(organizationId, accessoryStatusId) {
      const [row] = await db
        .select({ id: accessoryStatuses.id })
        .from(accessoryStatuses)
        .where(
          and(
            eq(accessoryStatuses.organizationId, organizationId),
            eq(accessoryStatuses.id, accessoryStatusId),
            isNull(accessoryStatuses.archivedAt),
          ),
        )
        .limit(1);
      return !!row;
    },
    async getDefaultStatusId(organizationId) {
      const [row] = await db
        .select({ id: accessoryStatuses.id })
        .from(accessoryStatuses)
        .where(and(eq(accessoryStatuses.organizationId, organizationId), isNull(accessoryStatuses.archivedAt)))
        .orderBy(asc(accessoryStatuses.sortOrder))
        .limit(1);
      return row?.id ?? null;
    },
    async createAccessoryItem(input) {
      const [row] = await db
        .insert(accessoryItems)
        .values({
          organizationId: input.organizationId,
          orderId: input.orderId,
          lookId: input.lookId,
          accessoryTypeId: input.accessoryTypeId,
          customLabel: input.customLabel,
          accessoryStatusId: input.accessoryStatusId,
          notes: input.notes,
        })
        .returning({ id: accessoryItems.id });
      return row;
    },
    async getAccessoryItem(organizationId, accessoryItemId) {
      const [row] = await db
        .select({
          id: accessoryItems.id,
          orderId: accessoryItems.orderId,
          version: accessoryItems.version,
          archivedAt: accessoryItems.archivedAt,
        })
        .from(accessoryItems)
        .where(and(eq(accessoryItems.organizationId, organizationId), eq(accessoryItems.id, accessoryItemId)))
        .limit(1);
      return row ?? null;
    },
    async updateAccessoryItem(input) {
      const rows = await db
        .update(accessoryItems)
        .set({
          lookId: input.lookId,
          accessoryTypeId: input.accessoryTypeId,
          customLabel: input.customLabel,
          accessoryStatusId: input.accessoryStatusId,
          notes: input.notes,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accessoryItems.organizationId, input.organizationId),
            eq(accessoryItems.id, input.accessoryItemId),
            eq(accessoryItems.version, input.expectedVersion),
          ),
        )
        .returning({ id: accessoryItems.id });
      if (!rows.length) throw new Error("This Accessory changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(accessoryItems)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accessoryItems.organizationId, input.organizationId),
            eq(accessoryItems.id, input.accessoryItemId),
            eq(accessoryItems.version, input.expectedVersion),
          ),
        )
        .returning({ id: accessoryItems.id });
      if (!rows.length) throw new Error("This Accessory changed. Reload and try again.");
    },
  };
}

export type AccessoryItemRow = {
  id: string;
  lookId: string | null;
  lookName: string | null;
  accessoryTypeId: string;
  typeName: string;
  typeArchived: boolean;
  customLabel: string | null;
  label: string;
  accessoryStatusId: string;
  statusName: string;
  statusIsCompleted: boolean;
  notes: string;
  version: number;
  archivedAt: Date | null;
  deliveryDate: AccessoryDeliveryDate;
};

/**
 * Every Accessory on an Order, with its inherited delivery date resolved against the Order's live
 * Looks. The date is computed here rather than stored, so moving a Look date moves every Accessory
 * that follows it without a migration or a background job.
 */
export async function listAccessoryItemsForOrder(
  organizationId: string,
  orderId: string,
): Promise<AccessoryItemRow[]> {
  const db = getDatabase();

  const [rows, lookRows] = await Promise.all([
    db
      .select({
        id: accessoryItems.id,
        lookId: accessoryItems.lookId,
        accessoryTypeId: accessoryItems.accessoryTypeId,
        typeName: accessoryTypes.name,
        typeArchivedAt: accessoryTypes.archivedAt,
        customLabel: accessoryItems.customLabel,
        accessoryStatusId: accessoryItems.accessoryStatusId,
        statusName: accessoryStatuses.name,
        statusIsCompleted: accessoryStatuses.isCompleted,
        notes: accessoryItems.notes,
        version: accessoryItems.version,
        archivedAt: accessoryItems.archivedAt,
        createdAt: accessoryItems.createdAt,
      })
      .from(accessoryItems)
      .innerJoin(accessoryTypes, eq(accessoryTypes.id, accessoryItems.accessoryTypeId))
      .innerJoin(accessoryStatuses, eq(accessoryStatuses.id, accessoryItems.accessoryStatusId))
      .where(and(eq(accessoryItems.organizationId, organizationId), eq(accessoryItems.orderId, orderId)))
      .orderBy(asc(accessoryItems.createdAt)),
    db
      .select({ id: looks.id, name: looks.name, lookDate: looks.lookDate, archivedAt: looks.archivedAt })
      .from(looks)
      .where(and(eq(looks.organizationId, organizationId), eq(looks.orderId, orderId))),
  ]);

  const lookSources: LookDateSource[] = lookRows.map((look) => ({
    id: look.id,
    lookDate: look.lookDate,
    archivedAt: look.archivedAt,
  }));
  const lookNames = new Map(lookRows.map((look) => [look.id, look.name]));

  return rows.map((row) => ({
    id: row.id,
    lookId: row.lookId,
    lookName: row.lookId ? (lookNames.get(row.lookId) ?? null) : null,
    accessoryTypeId: row.accessoryTypeId,
    typeName: row.typeName,
    typeArchived: !!row.typeArchivedAt,
    customLabel: row.customLabel,
    label: row.customLabel || row.typeName,
    accessoryStatusId: row.accessoryStatusId,
    statusName: row.statusName,
    statusIsCompleted: row.statusIsCompleted,
    notes: row.notes,
    version: row.version,
    archivedAt: row.archivedAt,
    deliveryDate: resolveAccessoryDeliveryDate({ lookId: row.lookId, looks: lookSources }),
  }));
}

/** Live Accessories on this Order that have not reached a completed status. */
export async function listOutstandingAccessories(organizationId: string, orderId: string) {
  const rows = await listAccessoryItemsForOrder(organizationId, orderId);
  return rows.filter((row) => !row.archivedAt && !row.statusIsCompleted);
}
