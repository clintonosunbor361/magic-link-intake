import "server-only";

import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEntries, clients, items, itemTypes, looks, orders } from "@/db/schema";
import type { ActiveOrderCreationRepository, OrderRepository } from "@/lib/orders/order-service";
import type { LookRepository } from "@/lib/orders/look-service";
import type { ItemRepository } from "@/lib/orders/item-service";

export function createOrderRepository(): OrderRepository {
  const db = getDatabase();
  return {
    async getOrderLifecycle(organizationId, orderId) {
      const [row] = await db
        .select({ id: orders.id, version: orders.version, archivedAt: orders.archivedAt })
        .from(orders)
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
        .limit(1);
      return row ?? null;
    },
    async updateOrderDetails(input) {
      const rows = await db
        .update(orders)
        .set({
          title: input.title,
          eventType: input.eventType,
          finalAgreedPriceMinor: input.finalAgreedPriceMinor,
          ffDiscount: input.ffDiscount,
          ffDiscountAmountMinor: input.ffDiscountAmountMinor,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.organizationId, input.organizationId),
            eq(orders.id, input.orderId),
            eq(orders.version, input.expectedVersion),
          ),
        )
        .returning({ id: orders.id });
      if (!rows.length) throw new Error("This Order changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(orders)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.organizationId, input.organizationId),
            eq(orders.id, input.orderId),
            eq(orders.version, input.expectedVersion),
          ),
        )
        .returning({ id: orders.id });
      if (!rows.length) throw new Error("This Order changed. Reload and try again.");
    },
  };
}

export function createActiveOrderRepository(): ActiveOrderCreationRepository {
  const db = getDatabase();
  return {
    async clientBelongsToOrganization(organizationId, clientId) {
      const [row] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId), isNull(clients.archivedAt))).limit(1);
      return Boolean(row);
    },
    async createOrderWithLooks(input) {
      return db.transaction(async (tx) => {
        const [order] = await tx.insert(orders).values({
          organizationId: input.organizationId,
          clientId: input.clientId,
          title: input.title,
          eventType: input.eventType,
          finalAgreedPriceMinor: input.finalAgreedPriceMinor,
          primaryOwnerStaffId: input.primaryOwnerStaffId,
          ffDiscount: input.ffDiscount,
          ffDiscountAmountMinor: input.ffDiscountAmountMinor,
        }).returning({ id: orders.id });
        const createdLooks = await tx.insert(looks).values(input.looks.map((look) => ({
          organizationId: input.organizationId,
          orderId: order.id,
          name: look.name,
          lookDate: look.lookDate,
          notes: look.notes,
        }))).returning({ id: looks.id });
        await tx.insert(auditEntries).values({ organizationId: input.organizationId, actorId: input.actorStaffId, action: "order.created", entityType: "order", entityId: order.id, summary: `Created Active Order "${input.title}" for an existing Client.`, metadata: { clientId: input.clientId, lookIds: createdLooks.map((look) => look.id), finalAgreedPriceMinor: input.finalAgreedPriceMinor } });
        return { orderId: order.id, lookIds: createdLooks.map((look) => look.id) };
      });
    },
  };
}

export function createLookRepository(): LookRepository {
  const db = getDatabase();
  return {
    async createLook(input) {
      const [row] = await db
        .insert(looks)
        .values({
          organizationId: input.organizationId,
          orderId: input.orderId,
          name: input.name,
          lookDate: input.lookDate,
          notes: input.notes || "",
        })
        .returning({ id: looks.id });
      return row;
    },
    async orderBelongsToOrganization(organizationId, orderId) {
      const [row] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
        .limit(1);
      return !!row;
    },
    async getLookLifecycle(organizationId, lookId) {
      const [row] = await db
        .select({ id: looks.id, orderId: looks.orderId, version: looks.version, archivedAt: looks.archivedAt })
        .from(looks)
        .where(and(eq(looks.organizationId, organizationId), eq(looks.id, lookId)))
        .limit(1);
      return row ?? null;
    },
    async updateLook(input) {
      const rows = await db
        .update(looks)
        .set({
          name: input.name,
          lookDate: input.lookDate,
          notes: input.notes || "",
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(looks.organizationId, input.organizationId),
            eq(looks.id, input.lookId),
            eq(looks.version, input.expectedVersion),
          ),
        )
        .returning({ id: looks.id });
      if (!rows.length) throw new Error("This Look changed. Reload and try again.");
    },
    async archiveLookIfNotLast(input) {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.organizationId, input.organizationId), eq(orders.id, input.orderId)))
          .for("update");
        if (!order) throw new Error("Order was not found.");

        const siblingLooks = await tx
          .select({ id: looks.id })
          .from(looks)
          .where(
            and(
              eq(looks.orderId, input.orderId),
              isNull(looks.archivedAt),
              ne(looks.id, input.lookId),
            ),
          );
        if (siblingLooks.length === 0) {
          throw new Error("An Order must have at least one Look.");
        }

        const rows = await tx
          .update(looks)
          .set({ archivedAt: new Date(), version: input.nextVersion, updatedAt: new Date() })
          .where(
            and(
              eq(looks.organizationId, input.organizationId),
              eq(looks.id, input.lookId),
              eq(looks.version, input.expectedVersion),
            ),
          )
          .returning({ id: looks.id });
        if (!rows.length) throw new Error("This Look changed. Reload and try again.");
      });
    },
    async restoreLook(input) {
      const rows = await db
        .update(looks)
        .set({ archivedAt: null, version: input.nextVersion, updatedAt: new Date() })
        .where(
          and(
            eq(looks.organizationId, input.organizationId),
            eq(looks.id, input.lookId),
            eq(looks.version, input.expectedVersion),
          ),
        )
        .returning({ id: looks.id });
      if (!rows.length) throw new Error("This Look changed. Reload and try again.");
    },
  };
}

export function createItemRepository(): ItemRepository {
  const db = getDatabase();
  return {
    async createItem(input) {
      const [row] = await db
        .insert(items)
        .values({
          organizationId: input.organizationId,
          lookId: input.lookId,
          itemTypeId: input.itemTypeId,
          customLabel: input.customLabel,
          quantity: input.quantity,
        })
        .returning({ id: items.id });
      return row;
    },
    async lookBelongsToOrganization(organizationId, lookId) {
      const [row] = await db
        .select({ id: looks.id })
        .from(looks)
        .where(and(eq(looks.organizationId, organizationId), eq(looks.id, lookId)))
        .limit(1);
      return !!row;
    },
    async getItemLifecycle(organizationId, itemId) {
      const [row] = await db
        .select({ id: items.id, version: items.version, archivedAt: items.archivedAt })
        .from(items)
        .where(and(eq(items.organizationId, organizationId), eq(items.id, itemId)))
        .limit(1);
      return row ?? null;
    },
    async updateItem(input) {
      const rows = await db
        .update(items)
        .set({
          itemTypeId: input.itemTypeId,
          customLabel: input.customLabel,
          quantity: input.quantity,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(items.organizationId, input.organizationId),
            eq(items.id, input.itemId),
            eq(items.version, input.expectedVersion),
          ),
        )
        .returning({ id: items.id });
      if (!rows.length) throw new Error("This Item changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(items)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(items.organizationId, input.organizationId),
            eq(items.id, input.itemId),
            eq(items.version, input.expectedVersion),
          ),
        )
        .returning({ id: items.id });
      if (!rows.length) throw new Error("This Item changed. Reload and try again.");
    },
  };
}

export const ORDERS_PAGE_SIZE = 25;

export async function listOrders(
  organizationId: string,
  options: { includeArchived?: boolean; search?: string; page?: number } = {},
) {
  const db = getDatabase();
  const conditions = [eq(orders.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(orders.archivedAt));

  if (options.search) {
    const term = `%${options.search.toLowerCase()}%`;
    const searchCondition = or(
      sql`lower(${orders.title}) like ${term}`,
      sql`lower(${clients.fullName}) like ${term}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const page = Math.max(1, options.page ?? 1);
  const rows = await db
    .select({
      id: orders.id,
      title: orders.title,
      eventType: orders.eventType,
      finalAgreedPriceMinor: orders.finalAgreedPriceMinor,
      archivedAt: orders.archivedAt,
      createdAt: orders.createdAt,
      clientId: clients.id,
      clientFullName: clients.fullName,
      lookCount: sql<number>`(
        select count(*) from looks l where l.order_id = ${orders.id} and l.archived_at is null
      )`,
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(ORDERS_PAGE_SIZE + 1)
    .offset((page - 1) * ORDERS_PAGE_SIZE);

  return {
    orders: rows.slice(0, ORDERS_PAGE_SIZE),
    hasNextPage: rows.length > ORDERS_PAGE_SIZE,
    page,
  };
}

export async function getOrder(organizationId: string, orderId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({
      id: orders.id,
      organizationId: orders.organizationId,
      clientId: orders.clientId,
      title: orders.title,
      eventType: orders.eventType,
      finalAgreedPriceMinor: orders.finalAgreedPriceMinor,
      primaryOwnerStaffId: orders.primaryOwnerStaffId,
      ffDiscount: orders.ffDiscount,
      ffDiscountAmountMinor: orders.ffDiscountAmountMinor,
      completedAt: orders.completedAt,
      completionOverrideReason: orders.completionOverrideReason,
      version: orders.version,
      archivedAt: orders.archivedAt,
      createdAt: orders.createdAt,
      clientFullName: clients.fullName,
      clientEmail: clients.email,
      clientWhatsappPhone: clients.whatsappPhone,
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
    .limit(1);
  return row ?? null;
}

export async function getOrderWithLooksAndItems(organizationId: string, orderId: string) {
  const db = getDatabase();
  const order = await getOrder(organizationId, orderId);
  if (!order) return null;

  const lookRows = await db
    .select({
      id: looks.id,
      name: looks.name,
      lookDate: looks.lookDate,
      notes: looks.notes,
      version: looks.version,
      archivedAt: looks.archivedAt,
    })
    .from(looks)
    .where(and(eq(looks.organizationId, organizationId), eq(looks.orderId, orderId)))
    .orderBy(looks.createdAt);

  const itemRows = await db
    .select({
      id: items.id,
      lookId: items.lookId,
      itemTypeId: items.itemTypeId,
      itemTypeName: itemTypes.name,
      customLabel: items.customLabel,
      quantity: items.quantity,
      version: items.version,
      archivedAt: items.archivedAt,
    })
    .from(items)
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .where(
      and(
        eq(items.organizationId, organizationId),
        sql`${items.lookId} in (select id from looks where order_id = ${orderId})`,
      ),
    )
    .orderBy(items.createdAt);

  const looksWithItems = lookRows.map((look) => ({
    ...look,
    items: itemRows.filter((item) => item.lookId === look.id),
  }));

  return { ...order, looks: looksWithItems };
}
