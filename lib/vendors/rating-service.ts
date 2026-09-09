import { assertCanRateVendors, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { assertValidScores, hasScoreChanged, type VendorRatingScores } from "@/lib/vendors/ratings";

// One rating per assignment; revisions preserve the previous scores.

export type VendorRatingRecord = { id: string; version: number } & VendorRatingScores;

export type VendorRatingRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  vendorIsAvailable(organizationId: string, vendorId: string): Promise<boolean>;
  assignmentIsReadyForRating(organizationId: string, orderId: string, vendorId: string, assignmentId: string): Promise<boolean>;
  getRating(organizationId: string, orderId: string, vendorId: string, assignmentId: string): Promise<VendorRatingRecord | null>;
  createRating(input: {
    organizationId: string;
    orderId: string;
    vendorId: string;
    assignmentId: string;
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
    assignmentId: string;
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
  if (!(await repository.assignmentIsReadyForRating(input.organizationId, input.orderId, input.vendorId, input.assignmentId))) {
    throw new Error("This assignment must belong to this Order and have completed production or a completed Order before rating.");
  }

  const existing = await repository.getRating(input.organizationId, input.orderId, input.vendorId, input.assignmentId);
  if (existing) {
    throw new Error("This Vendor is already rated on this assignment. Edit the existing rating instead.");
  }

  return repository.createRating({
    organizationId: input.organizationId,
    orderId: input.orderId,
    vendorId: input.vendorId,
    assignmentId: input.assignmentId,
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
    assignmentId: string;
    scores: VendorRatingScores;
    expectedVersion: number;
  },
  repository: VendorRatingRepository,
) {
  assertCanRateVendors(input.actor.role);
  const scores = assertValidScores(input.scores);

  const existing = await repository.getRating(input.organizationId, input.orderId, input.vendorId, input.assignmentId);
  if (!existing) throw new Error("This Vendor has not been rated on this assignment yet.");

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
    notFoundMessage: "This Vendor has not been rated on this assignment yet.",
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
