import "server-only";

import { and, or, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  clients,
  items,
  itemTypes,
  staffProfiles,
  looks,
  orders,
  productionStatuses,
  vendorAssignments,
  vendorRatingRevisions,
  vendorRatings,
  vendors,
} from "@/db/schema";
import type { VendorRatingRepository } from "@/lib/vendors/rating-service";

export function createVendorRatingRepository(): VendorRatingRepository {
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
    async vendorIsAvailable(organizationId, vendorId) {
      const [row] = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(and(eq(vendors.organizationId, organizationId), eq(vendors.id, vendorId)))
        .limit(1);
      return !!row;
    },
    async assignmentIsReadyForRating(organizationId, orderId, vendorId, assignmentId) {
      // Archived assignments count: a Vendor who was reassigned away from an Item still did the
      // work they did, and remains rateable on that Order.
      const [row] = await db
        .select({ id: vendorAssignments.id })
        .from(vendorAssignments)
        .innerJoin(items, eq(items.id, vendorAssignments.itemId))
        .innerJoin(looks, eq(looks.id, items.lookId))
        .innerJoin(orders, eq(orders.id, looks.orderId))
        .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
        .where(
          and(
            eq(vendorAssignments.organizationId, organizationId),
            eq(vendorAssignments.vendorId, vendorId),
            eq(vendorAssignments.id, assignmentId),
            eq(looks.orderId, orderId),
            or(isNotNull(orders.completedAt), eq(productionStatuses.isCompleted, true)),
          ),
        )
        .limit(1);
      return !!row;
    },
    async getRating(organizationId, orderId, vendorId, assignmentId) {
      const [row] = await db
        .select({
          id: vendorRatings.id,
          version: vendorRatings.version,
          quality: vendorRatings.quality,
          timeliness: vendorRatings.timeliness,
          communication: vendorRatings.communication,
        })
        .from(vendorRatings)
        .where(
          and(
            eq(vendorRatings.organizationId, organizationId),
            eq(vendorRatings.orderId, orderId),
            eq(vendorRatings.vendorId, vendorId),
            eq(vendorRatings.assignmentId, assignmentId),
            isNull(vendorRatings.archivedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async createRating(input) {
      const [row] = await db
        .insert(vendorRatings)
        .values({
          organizationId: input.organizationId,
          orderId: input.orderId,
          vendorId: input.vendorId,
          assignmentId: input.assignmentId,
          quality: input.scores.quality,
          timeliness: input.scores.timeliness,
          communication: input.scores.communication,
          ratedByStaffId: input.actorStaffId,
        })
        .returning({ id: vendorRatings.id });
      return row;
    },
    async updateRating(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(vendorRatings)
          .set({
            quality: input.next.quality,
            timeliness: input.next.timeliness,
            communication: input.next.communication,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vendorRatings.organizationId, input.organizationId),
              eq(vendorRatings.id, input.ratingId),
              eq(vendorRatings.version, input.expectedVersion),
            ),
          )
          .returning({ id: vendorRatings.id });
        if (!rows.length) throw new Error("This rating changed. Reload and try again.");

        await tx.insert(vendorRatingRevisions).values({
          organizationId: input.organizationId,
          vendorRatingId: input.ratingId,
          previousQuality: input.previous.quality,
          previousTimeliness: input.previous.timeliness,
          previousCommunication: input.previous.communication,
          newQuality: input.next.quality,
          newTimeliness: input.next.timeliness,
          newCommunication: input.next.communication,
          changedByStaffId: input.actorStaffId,
        });

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "vendor_rating.revised",
          entityType: "vendor_rating",
          entityId: input.ratingId,
          summary: "Revised a Vendor rating.",
          metadata: { previous: input.previous, next: input.next },
        });
      });
    },
  };
}

/** Assignment ratings, including existing ratings if production is subsequently reopened. */
export async function listOrderVendorsForRating(organizationId: string, orderId: string) {
  const db = getDatabase();
  return db
    .select({
      assignmentId: vendorAssignments.id,
      itemLabel: sql<string>`coalesce(nullif(${items.customLabel}, ''), ${itemTypes.name})`,
      lookName: looks.name,
      vendorId: vendors.id,
      vendorName: vendors.name,
      ratingId: vendorRatings.id,
      ratingVersion: vendorRatings.version,
      quality: vendorRatings.quality,
      timeliness: vendorRatings.timeliness,
      communication: vendorRatings.communication,
    })
    .from(vendorAssignments)
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .leftJoin(
      vendorRatings,
      and(
        eq(vendorRatings.orderId, orderId),
        eq(vendorRatings.vendorId, vendors.id),
        eq(vendorRatings.assignmentId, vendorAssignments.id),
        isNull(vendorRatings.archivedAt),
      ),
    )
    .where(and(eq(vendorAssignments.organizationId, organizationId), eq(looks.orderId, orderId),
      or(isNotNull(vendorRatings.id), isNotNull(orders.completedAt), eq(productionStatuses.isCompleted, true))))
    .orderBy(vendors.id);
}

/** Outstanding assignment ratings, derived idempotently from completed work or completed Orders. */
export async function listPendingRatingPrompts(organizationId: string) {
  const db = getDatabase();
  return db
    .select({
      assignmentId: vendorAssignments.id,
      lookName: looks.name,
      itemLabel: sql<string>`coalesce(nullif(${items.customLabel}, ''), ${itemTypes.name})`,
      orderId: orders.id,
      orderTitle: orders.title,
      completedAt: orders.completedAt,
      clientName: clients.fullName,
      vendorId: vendors.id,
      vendorName: vendors.name,
    })
    .from(vendorAssignments)
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .leftJoin(
      vendorRatings,
      and(
        eq(vendorRatings.orderId, orders.id),
        eq(vendorRatings.vendorId, vendors.id),
        eq(vendorRatings.assignmentId, vendorAssignments.id),
        isNull(vendorRatings.archivedAt),
      ),
    )
    .where(
      and(
        eq(vendorAssignments.organizationId, organizationId),
        // Completed production or Order completion surfaces each outstanding assignment once.
        or(isNotNull(orders.completedAt), eq(productionStatuses.isCompleted, true)),
        isNull(orders.archivedAt),
        isNull(vendorRatings.id),
      ),
    )
    .orderBy(orders.id, vendors.id);
}

export async function countVendorRatings(organizationId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorRatings)
    .where(eq(vendorRatings.organizationId, organizationId));
  return row?.count ?? 0;
}

/** Includes legacy Order ratings without assigning their evidence to an arbitrary Item. */
export async function listVendorRatingHistory(organizationId: string, vendorId: string) {
  const db = getDatabase();
  const ratings = await db.select({
    id: vendorRatings.id, assignmentId: vendorRatings.assignmentId,
    orderId: orders.id, orderTitle: orders.title, clientName: clients.fullName,
    lookName: looks.name,
    itemLabel: sql<string | null>`coalesce(nullif(${items.customLabel}, ''), ${itemTypes.name})`,
    quality: vendorRatings.quality, timeliness: vendorRatings.timeliness,
    communication: vendorRatings.communication, createdAt: vendorRatings.createdAt,
    archivedAt: vendorRatings.archivedAt, ratedBy: staffProfiles.fullName,
  }).from(vendorRatings)
    .innerJoin(orders, eq(orders.id, vendorRatings.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, vendorRatings.ratedByStaffId))
    .leftJoin(vendorAssignments, eq(vendorAssignments.id, vendorRatings.assignmentId))
    .leftJoin(items, eq(items.id, vendorAssignments.itemId))
    .leftJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .leftJoin(looks, eq(looks.id, items.lookId))
    .where(and(eq(vendorRatings.organizationId, organizationId), eq(vendorRatings.vendorId, vendorId)))
    .orderBy(desc(vendorRatings.createdAt));
  const revisions = await db.select({
    id: vendorRatingRevisions.id, ratingId: vendorRatingRevisions.vendorRatingId,
    previousQuality: vendorRatingRevisions.previousQuality, newQuality: vendorRatingRevisions.newQuality,
    previousTimeliness: vendorRatingRevisions.previousTimeliness, newTimeliness: vendorRatingRevisions.newTimeliness,
    previousCommunication: vendorRatingRevisions.previousCommunication, newCommunication: vendorRatingRevisions.newCommunication,
    createdAt: vendorRatingRevisions.createdAt, changedBy: staffProfiles.fullName,
  }).from(vendorRatingRevisions)
    .innerJoin(vendorRatings, eq(vendorRatings.id, vendorRatingRevisions.vendorRatingId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, vendorRatingRevisions.changedByStaffId))
    .where(and(eq(vendorRatingRevisions.organizationId, organizationId), eq(vendorRatings.organizationId, organizationId), eq(vendorRatings.vendorId, vendorId)))
    .orderBy(desc(vendorRatingRevisions.createdAt));
  return ratings.map((rating) => ({ ...rating, revisions: revisions.filter((revision) => revision.ratingId === rating.id) }));
}
