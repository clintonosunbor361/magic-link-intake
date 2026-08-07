import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  items,
  looks,
  orders,
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
    async vendorWorkedOnOrder(organizationId, orderId, vendorId) {
      // Archived assignments count: a Vendor who was reassigned away from an Item still did the
      // work they did, and remains rateable on that Order.
      const [row] = await db
        .select({ id: vendorAssignments.id })
        .from(vendorAssignments)
        .innerJoin(items, eq(items.id, vendorAssignments.itemId))
        .innerJoin(looks, eq(looks.id, items.lookId))
        .where(
          and(
            eq(vendorAssignments.organizationId, organizationId),
            eq(vendorAssignments.vendorId, vendorId),
            eq(looks.orderId, orderId),
          ),
        )
        .limit(1);
      return !!row;
    },
    async getRating(organizationId, orderId, vendorId) {
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

/** Distinct Vendors with an assignment on this Order, and their current rating if any. */
export async function listOrderVendorsForRating(organizationId: string, orderId: string) {
  const db = getDatabase();
  return db
    .selectDistinctOn([vendors.id], {
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
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .leftJoin(
      vendorRatings,
      and(
        eq(vendorRatings.orderId, orderId),
        eq(vendorRatings.vendorId, vendors.id),
        isNull(vendorRatings.archivedAt),
      ),
    )
    .where(and(eq(vendorAssignments.organizationId, organizationId), eq(looks.orderId, orderId)))
    .orderBy(vendors.id);
}

export async function countVendorRatings(organizationId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorRatings)
    .where(eq(vendorRatings.organizationId, organizationId));
  return row?.count ?? 0;
}
