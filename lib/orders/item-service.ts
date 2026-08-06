import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type ItemFields = { itemTypeId: string; customLabel: string | null; quantity: number };

export type ItemLifecycleRecord = { id: string; version: number; archivedAt: Date | null };

export type ItemRepository = {
  createItem(input: ItemFields & { organizationId: string; lookId: string }): Promise<{ id: string }>;
  lookBelongsToOrganization(organizationId: string, lookId: string): Promise<boolean>;
  getItemLifecycle(organizationId: string, itemId: string): Promise<ItemLifecycleRecord | null>;
  updateItem(
    input: ItemFields & {
      organizationId: string;
      itemId: string;
      expectedVersion: number;
      nextVersion: number;
    },
  ): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    itemId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

function assertValidFields(fields: ItemFields) {
  if (!fields.itemTypeId) throw new Error("Item type is required.");
  if (!Number.isInteger(fields.quantity) || fields.quantity <= 0) {
    throw new Error("Quantity must be at least 1.");
  }
}

export async function createItem(
  input: { organizationId: string; lookId: string; fields: ItemFields },
  repository: ItemRepository,
) {
  assertValidFields(input.fields);

  const lookExists = await repository.lookBelongsToOrganization(input.organizationId, input.lookId);
  if (!lookExists) throw new Error("Look was not found.");

  return repository.createItem({ organizationId: input.organizationId, lookId: input.lookId, ...input.fields });
}

export async function updateItem(
  input: { organizationId: string; itemId: string; expectedVersion: number; fields: ItemFields },
  repository: ItemRepository,
) {
  assertValidFields(input.fields);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getItemLifecycle(input.organizationId, input.itemId),
    notFoundMessage: "Item was not found.",
    staleMessage: "This Item changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateItem({
        organizationId: input.organizationId,
        itemId: input.itemId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        ...input.fields,
      }),
  });
}

export async function archiveItem(
  input: { actor: { organizationId: string; role: StaffRole }; itemId: string; expectedVersion: number },
  repository: ItemRepository,
) {
  if (!mayArchive("item", input.actor.role)) throw new Error("You cannot archive this Item.");
  return setArchivedState(input, true, repository);
}

export async function restoreItem(
  input: { actor: { organizationId: string; role: StaffRole }; itemId: string; expectedVersion: number },
  repository: ItemRepository,
) {
  if (!mayRestore("item", input.actor.role)) throw new Error("You cannot restore this Item.");
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; itemId: string; expectedVersion: number },
  archived: boolean,
  repository: ItemRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getItemLifecycle(input.actor.organizationId, input.itemId),
    notFoundMessage: "Item was not found.",
    staleMessage: "This Item changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        itemId: input.itemId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
