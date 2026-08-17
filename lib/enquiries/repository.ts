import "server-only";

import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  clients,
  enquiries,
  enquiryNotes,
  enquiryTasks,
  looks,
  orders,
  staffProfiles,
} from "@/db/schema";
import {
  findDuplicateMatches,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "@/lib/enquiries/duplicate-match";
import type { EnquiryRepository } from "@/lib/enquiries/service";
import type { FollowUpRepository } from "@/lib/enquiries/follow-up-service";
import type { ConversionRepository } from "@/lib/enquiries/conversion-service";

export function createEnquiryRepository(): EnquiryRepository {
  const db = getDatabase();
  return {
    async clientBelongsToOrganization(organizationId, clientId) {
      const [row] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId), isNull(clients.archivedAt))).limit(1);
      return Boolean(row);
    },
    async getDuplicateCandidates(organizationId) {
      const [enquiryRows, clientRows] = await Promise.all([
        db
          .select({
            id: enquiries.id,
            fullName: enquiries.fullName,
            nameNormalized: enquiries.nameNormalized,
            primaryPhone: enquiries.primaryPhone,
            primaryPhoneNormalized: enquiries.primaryPhoneNormalized,
            email: enquiries.email,
            emailNormalized: enquiries.emailNormalized,
          })
          .from(enquiries)
          .where(and(eq(enquiries.organizationId, organizationId), isNull(enquiries.archivedAt))),
        db
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
          .where(and(eq(clients.organizationId, organizationId), isNull(clients.archivedAt))),
      ]);

      return [
        ...enquiryRows.map((row) => ({ ...row, kind: "enquiry" as const })),
        ...clientRows.map((row) => ({ ...row, kind: "client" as const })),
      ];
    },
    async createInternalEnquiry(input) {
      const [row] = await db
        .insert(enquiries)
        .values({
          organizationId: input.organizationId,
          channel: "internal_staff",
          fullName: input.fullName,
          nameNormalized: normalizeName(input.fullName),
          primaryPhone: input.primaryPhone,
          primaryPhoneNormalized: normalizePhone(input.primaryPhone),
          whatsappSameAsPrimary: input.whatsappSameAsPrimary,
          whatsappPhone: input.whatsappSameAsPrimary ? input.primaryPhone : input.whatsappPhone,
          email: input.email || null,
          emailNormalized: input.email ? normalizeEmail(input.email) : null,
          preferredContactChannel: input.preferredContactChannel,
          eventType: input.eventType,
          budgetRange: input.budgetRange || null,
          brief: input.brief,
          leadSource: input.leadSource || null,
          ownerStaffId: input.ownerStaffId || null,
          internalNotes: input.internalNotes || null,
          linkedClientId: input.linkedClientId,
        })
        .returning({ id: enquiries.id });
      return row;
    },
    async getEnquiryLifecycle(organizationId, enquiryId) {
      const [row] = await db
        .select({ id: enquiries.id, version: enquiries.version, archivedAt: enquiries.archivedAt })
        .from(enquiries)
        .where(and(eq(enquiries.organizationId, organizationId), eq(enquiries.id, enquiryId)))
        .limit(1);
      return row ?? null;
    },
    async getEditableEnquiry(organizationId, enquiryId) {
      const [row] = await db
        .select({
          id: enquiries.id,
          version: enquiries.version,
          archivedAt: enquiries.archivedAt,
          convertedAt: enquiries.convertedAt,
        })
        .from(enquiries)
        .where(and(eq(enquiries.organizationId, organizationId), eq(enquiries.id, enquiryId)))
        .limit(1);
      return row ?? null;
    },
    async updateEnquiryDetails(input) {
      const rows = await db
        .update(enquiries)
        .set({
          fullName: input.fullName,
          nameNormalized: normalizeName(input.fullName),
          primaryPhone: input.primaryPhone,
          primaryPhoneNormalized: normalizePhone(input.primaryPhone),
          whatsappSameAsPrimary: input.whatsappSameAsPrimary,
          whatsappPhone: input.whatsappSameAsPrimary ? input.primaryPhone : input.whatsappPhone || null,
          email: input.email || null,
          emailNormalized: input.email ? normalizeEmail(input.email) : null,
          preferredContactChannel: input.preferredContactChannel,
          eventType: input.eventType,
          budgetRange: input.budgetRange || null,
          brief: input.brief,
          leadSource: input.leadSource || null,
          ownerStaffId: input.ownerStaffId || null,
          internalNotes: input.internalNotes || null,
          linkedClientId: input.linkedClientId,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(enquiries.organizationId, input.organizationId),
            eq(enquiries.id, input.enquiryId),
            eq(enquiries.version, input.expectedVersion),
            isNull(enquiries.convertedAt),
            isNull(enquiries.archivedAt),
          ),
        )
        .returning({ id: enquiries.id });
      if (!rows.length) throw new Error("This Enquiry changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(enquiries)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(enquiries.organizationId, input.organizationId),
            eq(enquiries.id, input.enquiryId),
            eq(enquiries.version, input.expectedVersion),
          ),
        )
        .returning({ id: enquiries.id });
      if (!rows.length) throw new Error("This Enquiry changed. Reload and try again.");
    },
  };
}

export function createFollowUpRepository(): FollowUpRepository {
  const db = getDatabase();
  return {
    async getEnquirySummary(organizationId, enquiryId) {
      const [row] = await db
        .select({ id: enquiries.id })
        .from(enquiries)
        .where(and(eq(enquiries.organizationId, organizationId), eq(enquiries.id, enquiryId)))
        .limit(1);
      return row ?? null;
    },
    async addNote(input) {
      const [row] = await db
        .insert(enquiryNotes)
        .values({
          organizationId: input.organizationId,
          enquiryId: input.enquiryId,
          note: input.note,
          occurredOn: input.occurredOn,
          nextFollowUpDate: input.nextFollowUpDate,
          createdByStaffId: input.createdByStaffId,
        })
        .returning({ id: enquiryNotes.id });
      return row;
    },
    async createTask(input) {
      const [row] = await db
        .insert(enquiryTasks)
        .values({
          organizationId: input.organizationId,
          enquiryId: input.enquiryId,
          title: input.title,
          dueDate: input.dueDate,
          assignedToStaffId: input.assignedToStaffId,
          note: input.note || "",
          createdByStaffId: input.createdByStaffId,
        })
        .returning({ id: enquiryTasks.id });
      return row;
    },
    async getTask(organizationId, taskId) {
      const [row] = await db
        .select({ id: enquiryTasks.id, version: enquiryTasks.version, status: enquiryTasks.status })
        .from(enquiryTasks)
        .where(and(eq(enquiryTasks.organizationId, organizationId), eq(enquiryTasks.id, taskId)))
        .limit(1);
      return row ?? null;
    },
    async setTaskStatus(input) {
      const rows = await db
        .update(enquiryTasks)
        .set({ status: input.status, version: input.nextVersion, updatedAt: new Date() })
        .where(
          and(
            eq(enquiryTasks.organizationId, input.organizationId),
            eq(enquiryTasks.id, input.taskId),
            eq(enquiryTasks.version, input.expectedVersion),
          ),
        )
        .returning({ id: enquiryTasks.id });
      if (!rows.length) throw new Error("This Task changed. Reload and try again.");
    },
  };
}

export function createConversionRepository(): ConversionRepository {
  const db = getDatabase();
  return {
    async getEnquiryForConversion(organizationId, enquiryId) {
      const [row] = await db
        .select({
          id: enquiries.id,
          version: enquiries.version,
          convertedAt: enquiries.convertedAt,
          archivedAt: enquiries.archivedAt,
          fullName: enquiries.fullName,
          linkedClientId: enquiries.linkedClientId,
          primaryPhone: enquiries.primaryPhone,
          email: enquiries.email,
        })
        .from(enquiries)
        .where(and(eq(enquiries.organizationId, organizationId), eq(enquiries.id, enquiryId)))
        .limit(1);
      return row ?? null;
    },
    async findClientIdentityConflict(input) {
      const rows = await db
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
            input.emailNormalized
              ? or(
                  eq(clients.primaryPhoneNormalized, input.primaryPhoneNormalized),
                  eq(clients.emailNormalized, input.emailNormalized),
                )
              : eq(clients.primaryPhoneNormalized, input.primaryPhoneNormalized),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        fullName: row.fullName,
        primaryPhone: row.primaryPhone,
        email: row.email,
        reason: row.primaryPhoneNormalized === input.primaryPhoneNormalized ? "phone" : "email",
      };
    },
    async convertEnquiry(input) {
      return db.transaction(async (tx) => {
        const [locked] = await tx
          .select({
            id: enquiries.id,
            version: enquiries.version,
            convertedAt: enquiries.convertedAt,
            fullName: enquiries.fullName,
            linkedClientId: enquiries.linkedClientId,
            primaryPhone: enquiries.primaryPhone,
            whatsappPhone: enquiries.whatsappPhone,
            email: enquiries.email,
          })
          .from(enquiries)
          .where(and(eq(enquiries.organizationId, input.organizationId), eq(enquiries.id, input.enquiryId)))
          .for("update");

        if (!locked) throw new Error("Enquiry was not found.");
        if (locked.convertedAt) throw new Error("This Enquiry has already been converted.");
        if (locked.version !== input.expectedVersion) {
          throw new Error("This Enquiry changed. Reload and try again.");
        }

        let clientId = input.existingClientId ?? locked.linkedClientId;
        if (!clientId) {
          const [newClient] = await tx
            .insert(clients)
            .values({
              organizationId: input.organizationId,
              fullName: locked.fullName,
              nameNormalized: normalizeName(locked.fullName),
              primaryPhone: locked.primaryPhone,
              primaryPhoneNormalized: normalizePhone(locked.primaryPhone),
              whatsappPhone: locked.whatsappPhone,
              email: locked.email,
              emailNormalized: locked.email ? normalizeEmail(locked.email) : null,
            })
            .returning({ id: clients.id });
          clientId = newClient.id;
        }

        const [order] = await tx
          .insert(orders)
          .values({
            organizationId: input.organizationId,
            clientId,
            title: input.order.title,
            eventType: input.order.eventType,
            finalAgreedPriceMinor: input.order.finalAgreedPriceMinor,
            primaryOwnerStaffId: input.order.primaryOwnerStaffId,
            ffDiscount: input.order.ffDiscount,
            ffDiscountAmountMinor: input.order.ffDiscountAmountMinor,
          })
          .returning({ id: orders.id });

        const [look] = await tx
          .insert(looks)
          .values({
            organizationId: input.organizationId,
            orderId: order.id,
            name: input.look.name,
            lookDate: input.look.lookDate,
            notes: input.look.notes || "",
          })
          .returning({ id: looks.id });

        const converted = await tx
          .update(enquiries)
          .set({
            convertedAt: new Date(),
            convertedClientId: clientId,
            convertedOrderId: order.id,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(and(eq(enquiries.id, input.enquiryId), eq(enquiries.version, input.expectedVersion)))
          .returning({ id: enquiries.id });
        if (!converted.length) throw new Error("This Enquiry changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "enquiry.converted",
          entityType: "enquiry",
          entityId: input.enquiryId,
          summary: `Converted ${locked.fullName} into a Client and Active Order "${input.order.title}".`,
          metadata: {
            clientId,
            orderId: order.id,
            lookId: look.id,
            reusedExistingClient: Boolean(clientId),
            finalAgreedPriceMinor: input.order.finalAgreedPriceMinor,
            ffDiscount: input.order.ffDiscount,
          },
        });

        return { clientId, orderId: order.id, lookId: look.id };
      });
    },
  };
}

export const ENQUIRIES_PAGE_SIZE = 25;

export async function listEnquiries(
  organizationId: string,
  options: { includeArchived?: boolean; search?: string; page?: number } = {},
) {
  const db = getDatabase();
  const conditions = [eq(enquiries.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(enquiries.archivedAt));

  if (options.search) {
    const term = `%${options.search.toLowerCase()}%`;
    const searchCondition = or(
      sql`lower(${enquiries.fullName}) like ${term}`,
      sql`${enquiries.primaryPhoneNormalized} like ${term}`,
      sql`lower(${enquiries.email}) like ${term}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const page = Math.max(1, options.page ?? 1);
  const rows = await db
    .select({
      id: enquiries.id,
      fullName: enquiries.fullName,
      primaryPhone: enquiries.primaryPhone,
      email: enquiries.email,
      channel: enquiries.channel,
      eventType: enquiries.eventType,
      budgetRange: enquiries.budgetRange,
      ownerStaffId: enquiries.ownerStaffId,
      convertedAt: enquiries.convertedAt,
      archivedAt: enquiries.archivedAt,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(and(...conditions))
    .orderBy(desc(enquiries.createdAt))
    // Fetch one extra row to know whether a next page exists, without a separate COUNT query.
    .limit(ENQUIRIES_PAGE_SIZE + 1)
    .offset((page - 1) * ENQUIRIES_PAGE_SIZE);

  return {
    enquiries: rows.slice(0, ENQUIRIES_PAGE_SIZE),
    hasNextPage: rows.length > ENQUIRIES_PAGE_SIZE,
    page,
  };
}

export async function getEnquiry(organizationId: string, enquiryId: string) {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(enquiries)
    .where(and(eq(enquiries.organizationId, organizationId), eq(enquiries.id, enquiryId)))
    .limit(1);
  return row ?? null;
}

export async function getDuplicateMatchesForEnquiry(organizationId: string, enquiryId: string) {
  const enquiry = await getEnquiry(organizationId, enquiryId);
  if (!enquiry) return [];

  const candidates = await createEnquiryRepository().getDuplicateCandidates(organizationId);
  return findDuplicateMatches(
    {
      primaryPhoneNormalized: enquiry.primaryPhoneNormalized,
      emailNormalized: enquiry.emailNormalized,
      nameNormalized: enquiry.nameNormalized,
    },
    candidates.filter((candidate) => !(candidate.kind === "enquiry" && candidate.id === enquiry.id)),
  );
}

export async function listOpenEnquiriesForClient(organizationId: string, clientId: string) {
  const db = getDatabase();
  return db.select({ id: enquiries.id, eventType: enquiries.eventType, brief: enquiries.brief, createdAt: enquiries.createdAt }).from(enquiries).where(and(eq(enquiries.organizationId, organizationId), eq(enquiries.linkedClientId, clientId), isNull(enquiries.convertedAt), isNull(enquiries.archivedAt))).orderBy(desc(enquiries.createdAt));
}

export async function getConvertedRecordReferences(
  organizationId: string,
  clientId: string,
  orderId: string,
): Promise<{ clientNumber: number; orderNumber: number } | null> {
  const db = getDatabase();
  const [clientRows, orderRows] = await Promise.all([
    db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.organizationId, organizationId))
      .orderBy(asc(clients.createdAt), asc(clients.id)),
    db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.organizationId, organizationId))
      .orderBy(asc(orders.createdAt), asc(orders.id)),
  ]);
  const clientIndex = clientRows.findIndex((row) => row.id === clientId);
  const orderIndex = orderRows.findIndex((row) => row.id === orderId);
  if (clientIndex < 0 || orderIndex < 0) return null;
  return { clientNumber: clientIndex + 1, orderNumber: orderIndex + 1 };
}

export async function searchClients(organizationId: string, search: string) {
  const db = getDatabase();
  const term = `%${search.toLowerCase()}%`;
  const searchCondition = or(
    sql`lower(${clients.fullName}) like ${term}`,
    sql`${clients.primaryPhoneNormalized} like ${term}`,
  );

  return db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      primaryPhone: clients.primaryPhone,
      email: clients.email,
      latestOrderTitle: sql<string | null>`(
        select o.title from orders o
        where o.client_id = ${clients.id}
        order by o.created_at desc
        limit 1
      )`,
    })
    .from(clients)
    .where(
      and(
        eq(clients.organizationId, organizationId),
        isNull(clients.archivedAt),
        searchCondition,
      ),
    )
    .orderBy(clients.fullName)
    .limit(20);
}

export async function listFollowUpNotes(enquiryId: string) {
  const db = getDatabase();
  return db
    .select({
      id: enquiryNotes.id,
      note: enquiryNotes.note,
      occurredOn: enquiryNotes.occurredOn,
      nextFollowUpDate: enquiryNotes.nextFollowUpDate,
      createdAt: enquiryNotes.createdAt,
      createdByName: staffProfiles.fullName,
    })
    .from(enquiryNotes)
    .leftJoin(staffProfiles, eq(staffProfiles.id, enquiryNotes.createdByStaffId))
    .where(eq(enquiryNotes.enquiryId, enquiryId))
    .orderBy(desc(enquiryNotes.createdAt));
}

export async function listTasks(enquiryId: string) {
  const db = getDatabase();
  return db
    .select({
      id: enquiryTasks.id,
      title: enquiryTasks.title,
      dueDate: enquiryTasks.dueDate,
      status: enquiryTasks.status,
      note: enquiryTasks.note,
      version: enquiryTasks.version,
      assignedToName: staffProfiles.fullName,
    })
    .from(enquiryTasks)
    .leftJoin(staffProfiles, eq(staffProfiles.id, enquiryTasks.assignedToStaffId))
    .where(and(eq(enquiryTasks.enquiryId, enquiryId), isNull(enquiryTasks.archivedAt)))
    .orderBy(enquiryTasks.dueDate);
}
