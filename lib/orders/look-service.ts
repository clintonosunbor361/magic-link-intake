import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type LookFields = { name: string; lookDate: string | null; notes: string };

export type LookLifecycleRecord = { id: string; orderId: string; version: number; archivedAt: Date | null };

export type LookRepository = {
  createLook(input: LookFields & { organizationId: string; orderId: string }): Promise<{ id: string }>;
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  getLookLifecycle(organizationId: string, lookId: string): Promise<LookLifecycleRecord | null>;
  updateLook(
    input: LookFields & {
      organizationId: string;
      lookId: string;
      expectedVersion: number;
      nextVersion: number;
    },
  ): Promise<void>;
  // Row-locks the parent Order and counts sibling non-archived Looks inside one
  // transaction before archiving, so a Look can never be archived down to zero.
  archiveLookIfNotLast(input: {
    organizationId: string;
    orderId: string;
    lookId: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  restoreLook(input: {
    organizationId: string;
    lookId: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createLook(
  input: { organizationId: string; orderId: string; fields: LookFields },
  repository: LookRepository,
) {
  if (!input.fields.name.trim()) throw new Error("Look name is required.");

  const orderExists = await repository.orderBelongsToOrganization(input.organizationId, input.orderId);
  if (!orderExists) throw new Error("Order was not found.");

  return repository.createLook({ organizationId: input.organizationId, orderId: input.orderId, ...input.fields });
}

export async function updateLook(
  input: { organizationId: string; lookId: string; expectedVersion: number; fields: LookFields },
  repository: LookRepository,
) {
  if (!input.fields.name.trim()) throw new Error("Look name is required.");

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getLookLifecycle(input.organizationId, input.lookId),
    notFoundMessage: "Look was not found.",
    staleMessage: "This Look changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateLook({
        organizationId: input.organizationId,
        lookId: input.lookId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        ...input.fields,
      }),
  });
}

export async function archiveLook(
  input: { actor: { organizationId: string; role: StaffRole }; orderId: string; lookId: string; expectedVersion: number },
  repository: LookRepository,
) {
  if (!mayArchive("look", input.actor.role)) throw new Error("You cannot archive this Look.");

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getLookLifecycle(input.actor.organizationId, input.lookId),
    notFoundMessage: "Look was not found.",
    staleMessage: "This Look changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.archiveLookIfNotLast({
        organizationId: input.actor.organizationId,
        orderId: input.orderId,
        lookId: input.lookId,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

export async function restoreLook(
  input: { actor: { organizationId: string; role: StaffRole }; lookId: string; expectedVersion: number },
  repository: LookRepository,
) {
  if (!mayRestore("look", input.actor.role)) throw new Error("You cannot restore this Look.");

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getLookLifecycle(input.actor.organizationId, input.lookId),
    notFoundMessage: "Look was not found.",
    staleMessage: "This Look changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.restoreLook({
        organizationId: input.actor.organizationId,
        lookId: input.lookId,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
