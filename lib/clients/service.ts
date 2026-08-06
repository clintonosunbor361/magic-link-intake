import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type ClientIdentityFields = {
  fullName: string;
  primaryPhone: string;
  whatsappPhone: string;
  email: string;
};

export type ClientLifecycleRecord = { id: string; version: number; archivedAt: Date | null };

export type ClientRepository = {
  getClientLifecycle(organizationId: string, clientId: string): Promise<ClientLifecycleRecord | null>;
  updateClientIdentity(
    input: ClientIdentityFields & {
      organizationId: string;
      clientId: string;
      expectedVersion: number;
      nextVersion: number;
    },
  ): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    clientId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function updateClientIdentity(
  input: {
    organizationId: string;
    clientId: string;
    expectedVersion: number;
    fields: ClientIdentityFields;
  },
  repository: ClientRepository,
) {
  if (!input.fields.fullName.trim()) throw new Error("Full name is required.");
  if (!input.fields.primaryPhone.trim()) throw new Error("Primary phone is required.");

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getClientLifecycle(input.organizationId, input.clientId),
    notFoundMessage: "Client was not found.",
    staleMessage: "This Client changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateClientIdentity({
        organizationId: input.organizationId,
        clientId: input.clientId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        ...input.fields,
      }),
  });
}

export async function archiveClient(
  input: { actor: { organizationId: string; role: StaffRole }; clientId: string; expectedVersion: number },
  repository: ClientRepository,
) {
  if (!mayArchive("client", input.actor.role)) throw new Error("You cannot archive this Client.");
  return setArchivedState(input, true, repository);
}

export async function restoreClient(
  input: { actor: { organizationId: string; role: StaffRole }; clientId: string; expectedVersion: number },
  repository: ClientRepository,
) {
  if (!mayRestore("client", input.actor.role)) throw new Error("You cannot restore this Client.");
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; clientId: string; expectedVersion: number },
  archived: boolean,
  repository: ClientRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getClientLifecycle(input.actor.organizationId, input.clientId),
    notFoundMessage: "Client was not found.",
    staleMessage: "This Client changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        clientId: input.clientId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
