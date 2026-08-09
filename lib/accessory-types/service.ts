import { assertCanManageAccessoryTypes, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

// Configurable list, same shape as item types: Super Admin manages what exists, Admin Assistant
// selects. Types are archived rather than deleted so existing Accessory Items keep resolving to a
// real name. "Other" is just a seeded type — the free-text label on the Accessory Item is what
// actually satisfies the spec's "Other/custom is allowed" rule.

export type AccessoryTypeLifecycleRecord = { id: string; version: number };

export type AccessoryTypeRepository = {
  createAccessoryType(input: { organizationId: string; name: string; sortOrder: number }): Promise<{ id: string }>;
  getAccessoryType(organizationId: string, accessoryTypeId: string): Promise<AccessoryTypeLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    accessoryTypeId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createAccessoryType(
  input: { actor: { role: StaffRole }; organizationId: string; name: string; sortOrder: number },
  repository: AccessoryTypeRepository,
) {
  assertCanManageAccessoryTypes(input.actor.role);
  const name = input.name.trim();
  if (!name) throw new Error("Accessory type name is required.");

  return repository.createAccessoryType({
    organizationId: input.organizationId,
    name,
    sortOrder: input.sortOrder,
  });
}

export async function archiveAccessoryType(
  input: { actor: { role: StaffRole }; organizationId: string; accessoryTypeId: string; expectedVersion: number },
  repository: AccessoryTypeRepository,
) {
  assertCanManageAccessoryTypes(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreAccessoryType(
  input: { actor: { role: StaffRole }; organizationId: string; accessoryTypeId: string; expectedVersion: number },
  repository: AccessoryTypeRepository,
) {
  assertCanManageAccessoryTypes(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; accessoryTypeId: string; expectedVersion: number },
  archived: boolean,
  repository: AccessoryTypeRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getAccessoryType(input.organizationId, input.accessoryTypeId),
    notFoundMessage: "Accessory type was not found.",
    staleMessage: "This accessory type changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        accessoryTypeId: input.accessoryTypeId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
