import "server-only";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { clients, orders } from "@/db/schema";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/enquiries/duplicate-match";
import type { ClientRepository } from "@/lib/clients/service";

export function createClientRepository(): ClientRepository {
  const db = getDatabase();
  return {
    async getDuplicateCandidates(organizationId) {
      const rows = await db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          nameNormalized: clients.nameNormalized,
          primaryPhone: clients.primaryPhone,
          primaryPhoneNormalized: clients.primaryPhoneNormalized,
          email: clients.email,
          emailNormalized: clients.emailNormalized,
        })
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), isNull(clients.archivedAt)));

      return rows.map((row) => ({ ...row, kind: "client" as const }));
    },
    async createClient(input) {
      const [row] = await db
        .insert(clients)
        .values({
          organizationId: input.organizationId,
          fullName: input.fullName,
          nameNormalized: normalizeName(input.fullName),
          primaryPhone: input.primaryPhone,
          primaryPhoneNormalized: normalizePhone(input.primaryPhone),
          whatsappPhone: input.whatsappSameAsPrimary ? input.primaryPhone : input.whatsappPhone || null,
          email: input.email || null,
          emailNormalized: input.email ? normalizeEmail(input.email) : null,
          preferredContactChannel: input.preferredContactChannel || null,
          eventType: input.eventType || null,
          budgetRange: input.budgetRange || null,
          brief: input.brief,
          leadSource: input.leadSource || null,
          ownerStaffId: input.ownerStaffId || null,
          internalNotes: input.internalNotes || null,
        })
        .returning({ id: clients.id });
      return row;
    },
    async getClientLifecycle(organizationId, clientId) {
      const [row] = await db
        .select({ id: clients.id, version: clients.version, archivedAt: clients.archivedAt })
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)))
        .limit(1);
      return row ?? null;
    },
    async findIdentityConflict(input) {
      const matches = await db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          primaryPhone: clients.primaryPhone,
          primaryPhoneNormalized: clients.primaryPhoneNormalized,
          email: clients.email,
          emailNormalized: clients.emailNormalized,
        })
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, input.organizationId),
            isNull(clients.archivedAt),
            sql`${clients.id} <> ${input.clientId}`,
            input.emailNormalized
              ? or(
                  eq(clients.primaryPhoneNormalized, input.primaryPhoneNormalized),
                  eq(clients.emailNormalized, input.emailNormalized),
                )
              : eq(clients.primaryPhoneNormalized, input.primaryPhoneNormalized),
          ),
        )
        .limit(1);

      const match = matches[0];
      if (!match) return null;
      return {
        id: match.id,
        fullName: match.fullName,
        primaryPhone: match.primaryPhone,
        email: match.email,
        reason: match.primaryPhoneNormalized === input.primaryPhoneNormalized ? "phone" : "email",
      };
    },
    async updateClientIdentity(input) {
      const rows = await db
        .update(clients)
        .set({
          fullName: input.fullName,
          nameNormalized: normalizeName(input.fullName),
          primaryPhone: input.primaryPhone,
          primaryPhoneNormalized: normalizePhone(input.primaryPhone),
          whatsappPhone: input.whatsappPhone || null,
          email: input.email || null,
          emailNormalized: input.email ? normalizeEmail(input.email) : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clients.organizationId, input.organizationId),
            eq(clients.id, input.clientId),
            eq(clients.version, input.expectedVersion),
          ),
        )
        .returning({ id: clients.id });
      if (!rows.length) throw new Error("This Client changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(clients)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clients.organizationId, input.organizationId),
            eq(clients.id, input.clientId),
            eq(clients.version, input.expectedVersion),
          ),
        )
        .returning({ id: clients.id });
      if (!rows.length) throw new Error("This Client changed. Reload and try again.");
    },
  };
}

export const CLIENTS_PAGE_SIZE = 25;

export async function listClients(
  organizationId: string,
  options: { includeArchived?: boolean; search?: string; page?: number; orderState?: "all" | "without_orders" | "with_orders" } = {},
) {
  const db = getDatabase();
  const conditions = [eq(clients.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(clients.archivedAt));

  if (options.search) {
    const term = `%${options.search.toLowerCase()}%`;
    const searchCondition = or(
      sql`lower(${clients.fullName}) like ${term}`,
      sql`${clients.primaryPhoneNormalized} like ${term}`,
      sql`lower(${clients.email}) like ${term}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (options.orderState === "without_orders") {
    conditions.push(sql`not exists (
      select 1 from orders o
      where o.client_id = ${sql.raw('"clients"."id"')} and o.archived_at is null
    )`);
  }
  if (options.orderState === "with_orders") {
    conditions.push(sql`exists (
      select 1 from orders o
      where o.client_id = ${sql.raw('"clients"."id"')} and o.archived_at is null
    )`);
  }

  const page = Math.max(1, options.page ?? 1);
  const rows = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      primaryPhone: clients.primaryPhone,
      email: clients.email,
      archivedAt: clients.archivedAt,
      createdAt: clients.createdAt,
      latestOrderTitle: sql<string | null>`(
        select o.title from orders o
        where o.client_id = ${sql.raw('"clients"."id"')} and o.archived_at is null
        order by o.created_at desc
        limit 1
      )`,
      orderCount: sql<number>`(
        select count(*)::int from orders o
        where o.client_id = ${sql.raw('"clients"."id"')} and o.archived_at is null
      )`,
    })
    .from(clients)
    .where(and(...conditions))
    .orderBy(desc(clients.createdAt))
    .limit(CLIENTS_PAGE_SIZE + 1)
    .offset((page - 1) * CLIENTS_PAGE_SIZE);

  return {
    clients: rows.slice(0, CLIENTS_PAGE_SIZE),
    hasNextPage: rows.length > CLIENTS_PAGE_SIZE,
    page,
  };
}

/** Minimal id/name pairs for filter and picker dropdowns. */
export async function listClientOptions(organizationId: string) {
  const db = getDatabase();
  return db
    .select({ id: clients.id, fullName: clients.fullName })
    .from(clients)
    .where(and(eq(clients.organizationId, organizationId), isNull(clients.archivedAt)))
    .orderBy(clients.fullName);
}

export async function getClient(organizationId: string, clientId: string) {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)))
    .limit(1);
  return row ?? null;
}

export async function listOrdersForClient(organizationId: string, clientId: string) {
  const db = getDatabase();
  return db
    .select({
      id: orders.id,
      title: orders.title,
      eventType: orders.eventType,
      finalAgreedPriceMinor: orders.finalAgreedPriceMinor,
      archivedAt: orders.archivedAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.organizationId, organizationId), eq(orders.clientId, clientId)))
    .orderBy(desc(orders.createdAt));
}
