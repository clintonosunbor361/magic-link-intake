import { assertCanManageItemTypes, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

export type ItemTypeLifecycleRecord = { id: string; version: number };

export type ItemTypeRepository = {
  createItemType(input: { organizationId: string; name: string; sortOrder: number }): Promise<{ id: string }>;
  getItemType(organizationId: string, itemTypeId: string): Promise<ItemTypeLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    itemTypeId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createItemType(
  input: { actor: { role: StaffRole }; organizationId: string; name: string; sortOrder: number },
  repository: ItemTypeRepository,
) {
  assertCanManageItemTypes(input.actor.role);
  if (!input.name.trim()) throw new Error("Item type name is required.");

  const created = await repository.createItemType({
    organizationId: input.organizationId,
    name: input.name.trim(),
    sortOrder: input.sortOrder,
  });
  return { id: created.id };
}

export async function archiveItemType(
  input: { actor: { role: StaffRole }; organizationId: string; itemTypeId: string; expectedVersion: number },
  repository: ItemTypeRepository,
) {
  assertCanManageItemTypes(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreItemType(
  input: { actor: { role: StaffRole }; organizationId: string; itemTypeId: string; expectedVersion: number },
  repository: ItemTypeRepository,
) {
  assertCanManageItemTypes(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; itemTypeId: string; expectedVersion: number },
  archived: boolean,
  repository: ItemTypeRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getItemType(input.organizationId, input.itemTypeId),
    notFoundMessage: "Item Type was not found.",
    staleMessage: "This Item Type changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        itemTypeId: input.itemTypeId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
