import { assertCanRateVendors, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { assertValidScores, hasScoreChanged, type VendorRatingScores } from "@/lib/vendors/ratings";

// One rating per (Order, Vendor). Ratings are editable rather than immutable: a rating is a
// judgement, and judgements legitimately change when the reason for a low score turns out to belong
// to someone else. Each edit appends a revision row with explicit previous/new scores, so the
// correction is recoverable without a second row polluting the average.
//
// Milestone 5 builds this service and its table; the prompt flow that surfaces "rate the vendors on
// this completed Order" is Milestone 7 and is deliberately not built here.

export type VendorRatingRecord = { id: string; version: number } & VendorRatingScores;

export type VendorRatingRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  vendorIsAvailable(organizationId: string, vendorId: string): Promise<boolean>;
  vendorWorkedOnOrder(organizationId: string, orderId: string, vendorId: string): Promise<boolean>;
  getRating(organizationId: string, orderId: string, vendorId: string): Promise<VendorRatingRecord | null>;
  createRating(input: {
    organizationId: string;
    orderId: string;
    vendorId: string;
    scores: VendorRatingScores;
    actorStaffId: string;
  }): Promise<{ id: string }>;
  updateRating(input: {
    organizationId: string;
    ratingId: string;
    previous: VendorRatingScores;
    next: VendorRatingScores;
    actorStaffId: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function rateVendorOnOrder(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    orderId: string;
    vendorId: string;
    scores: VendorRatingScores;
  },
  repository: VendorRatingRepository,
) {
  assertCanRateVendors(input.actor.role);
  const scores = assertValidScores(input.scores);

  if (!(await repository.orderBelongsToOrganization(input.organizationId, input.orderId))) {
    throw new Error("Order was not found.");
  }
  if (!(await repository.vendorIsAvailable(input.organizationId, input.vendorId))) {
    throw new Error("Vendor was not found.");
  }
  // A Vendor can only be rated on an Order they actually worked on — otherwise a rating would
  // attach to a relationship that never existed.
  if (!(await repository.vendorWorkedOnOrder(input.organizationId, input.orderId, input.vendorId))) {
    throw new Error("This Vendor has no assignment on this Order.");
  }

  const existing = await repository.getRating(input.organizationId, input.orderId, input.vendorId);
  if (existing) {
    throw new Error("This Vendor is already rated on this Order. Edit the existing rating instead.");
  }

  return repository.createRating({
    organizationId: input.organizationId,
    orderId: input.orderId,
    vendorId: input.vendorId,
    scores,
    actorStaffId: input.actor.staffId,
  });
}

export async function reviseVendorRating(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    orderId: string;
    vendorId: string;
    scores: VendorRatingScores;
    expectedVersion: number;
  },
  repository: VendorRatingRepository,
) {
  assertCanRateVendors(input.actor.role);
  const scores = assertValidScores(input.scores);

  const existing = await repository.getRating(input.organizationId, input.orderId, input.vendorId);
  if (!existing) throw new Error("This Vendor has not been rated on this Order yet.");

  const previous: VendorRatingScores = {
    quality: existing.quality,
    timeliness: existing.timeliness,
    communication: existing.communication,
  };
  // A no-op save should not manufacture a revision row that implies someone changed their mind.
  if (!hasScoreChanged(previous, scores)) return { ok: true as const, nextVersion: existing.version };

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => existing,
    notFoundMessage: "This Vendor has not been rated on this Order yet.",
    staleMessage: "This rating changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateRating({
        organizationId: input.organizationId,
        ratingId: existing.id,
        previous,
        next: scores,
        actorStaffId: input.actor.staffId,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
