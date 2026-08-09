import { assertCanManageAccessoryStatuses, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

// The accessory equivalent of production statuses, including the same invariant: at least one live
// status must be marked delivered/completed. That marker is what the Order-completion warning reads
// to decide whether an Accessory is still outstanding, so a list with none would silently stop the
// warning from ever firing.

export type AccessoryStatusLifecycleRecord = { id: string; version: number; isCompleted: boolean };

export type AccessoryStatusRepository = {
  createAccessoryStatus(input: {
    organizationId: string;
    name: string;
    sortOrder: number;
    isCompleted: boolean;
  }): Promise<{ id: string }>;
  getAccessoryStatus(organizationId: string, statusId: string): Promise<AccessoryStatusLifecycleRecord | null>;
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

export async function createAccessoryStatus(
  input: {
    actor: { role: StaffRole };
    organizationId: string;
    name: string;
    sortOrder: number;
    isCompleted: boolean;
  },
  repository: AccessoryStatusRepository,
) {
  assertCanManageAccessoryStatuses(input.actor.role);
  const name = input.name.trim();
  if (!name) throw new Error("Status name is required.");

  return repository.createAccessoryStatus({
    organizationId: input.organizationId,
    name,
    sortOrder: input.sortOrder,
    isCompleted: input.isCompleted,
  });
}

export async function archiveAccessoryStatus(
  input: { actor: { role: StaffRole }; organizationId: string; statusId: string; expectedVersion: number },
  repository: AccessoryStatusRepository,
) {
  assertCanManageAccessoryStatuses(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      const current = await repository.getAccessoryStatus(input.organizationId, input.statusId);
      if (current?.isCompleted) await assertAnotherCompletedStatusRemains(input, repository);
      return current;
    },
    notFoundMessage: "Accessory status was not found.",
    staleMessage: "This accessory status changed. Reload and try again.",
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

export async function restoreAccessoryStatus(
  input: { actor: { role: StaffRole }; organizationId: string; statusId: string; expectedVersion: number },
  repository: AccessoryStatusRepository,
) {
  assertCanManageAccessoryStatuses(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getAccessoryStatus(input.organizationId, input.statusId),
    notFoundMessage: "Accessory status was not found.",
    staleMessage: "This accessory status changed. Reload and try again.",
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

export async function setAccessoryStatusCompleted(
  input: {
    actor: { role: StaffRole };
    organizationId: string;
    statusId: string;
    isCompleted: boolean;
    expectedVersion: number;
  },
  repository: AccessoryStatusRepository,
) {
  assertCanManageAccessoryStatuses(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      // Un-marking the last completed status would leave the list with no delivered end.
      if (!input.isCompleted) await assertAnotherCompletedStatusRemains(input, repository);
      return repository.getAccessoryStatus(input.organizationId, input.statusId);
    },
    notFoundMessage: "Accessory status was not found.",
    staleMessage: "This accessory status changed. Reload and try again.",
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
  repository: AccessoryStatusRepository,
) {
  const remaining = await repository.countOtherLiveCompletedStatuses(input.organizationId, input.statusId);
  if (remaining === 0) {
    throw new Error("At least one accessory status must be marked as delivered/completed.");
  }
}
