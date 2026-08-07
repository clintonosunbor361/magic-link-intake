import { assertCanManageProductionStatuses, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

// One shared, configurable status list applies to every item/vendor assignment. Super Admin manages
// it; Admin Assistants only select from it. Statuses are archived, never hard-deleted, so historical
// status-history rows keep resolving to a real name.
//
// The one invariant beyond the usual list rules: at least one live status must be marked completed.
// Completed semantics drive the Vendor picker's completed-vs-open job counts and the Milestone 7
// rating prompt, so a list with none would quietly break both.

export type ProductionStatusLifecycleRecord = { id: string; version: number; isCompleted: boolean };

export type ProductionStatusRepository = {
  createProductionStatus(input: {
    organizationId: string;
    name: string;
    sortOrder: number;
    isCompleted: boolean;
  }): Promise<{ id: string }>;
  getProductionStatus(organizationId: string, statusId: string): Promise<ProductionStatusLifecycleRecord | null>;
  countOtherLiveCompletedStatuses(organizationId: string, excludingStatusId: string): Promise<number>;
  setArchivedState(input: {
    organizationId: string;
    statusId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  setCompletedSemantics(input: {
    organizationId: string;
    statusId: string;
    isCompleted: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createProductionStatus(
  input: {
    actor: { role: StaffRole };
    organizationId: string;
    name: string;
    sortOrder: number;
    isCompleted: boolean;
  },
  repository: ProductionStatusRepository,
) {
  assertCanManageProductionStatuses(input.actor.role);
  const name = input.name.trim();
  if (!name) throw new Error("Status name is required.");

  return repository.createProductionStatus({
    organizationId: input.organizationId,
    name,
    sortOrder: input.sortOrder,
    isCompleted: input.isCompleted,
  });
}

export async function archiveProductionStatus(
  input: { actor: { role: StaffRole }; organizationId: string; statusId: string; expectedVersion: number },
  repository: ProductionStatusRepository,
) {
  assertCanManageProductionStatuses(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      const current = await repository.getProductionStatus(input.organizationId, input.statusId);
      if (current?.isCompleted) await assertAnotherCompletedStatusRemains(input, repository);
      return current;
    },
    notFoundMessage: "Production status was not found.",
    staleMessage: "This production status changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        statusId: input.statusId,
        archived: true,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

export async function restoreProductionStatus(
  input: { actor: { role: StaffRole }; organizationId: string; statusId: string; expectedVersion: number },
  repository: ProductionStatusRepository,
) {
  assertCanManageProductionStatuses(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getProductionStatus(input.organizationId, input.statusId),
    notFoundMessage: "Production status was not found.",
    staleMessage: "This production status changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        statusId: input.statusId,
        archived: false,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

export async function setProductionStatusCompletedSemantics(
  input: {
    actor: { role: StaffRole };
    organizationId: string;
    statusId: string;
    isCompleted: boolean;
    expectedVersion: number;
  },
  repository: ProductionStatusRepository,
) {
  assertCanManageProductionStatuses(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      const current = await repository.getProductionStatus(input.organizationId, input.statusId);
      // Clearing the flag is only allowed while some other live status still carries it.
      if (current?.isCompleted && !input.isCompleted) {
        await assertAnotherCompletedStatusRemains(input, repository);
      }
      return current;
    },
    notFoundMessage: "Production status was not found.",
    staleMessage: "This production status changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setCompletedSemantics({
        organizationId: input.organizationId,
        statusId: input.statusId,
        isCompleted: input.isCompleted,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

async function assertAnotherCompletedStatusRemains(
  input: { organizationId: string; statusId: string },
  repository: ProductionStatusRepository,
) {
  const remaining = await repository.countOtherLiveCompletedStatuses(input.organizationId, input.statusId);
  if (remaining < 1) {
    throw new Error("At least one production status must be marked as completed.");
  }
}
