import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";
import { findDuplicateMatches, normalizeEmail, normalizeName, normalizePhone, type DuplicateCandidate, type DuplicateMatch } from "@/lib/clients/duplicate-match";

export type ClientIdentityFields = {
  fullName: string;
  primaryPhone: string;
  whatsappPhone: string;
  email: string;
};

export type ClientContactFields = ClientIdentityFields & {
  whatsappSameAsPrimary: boolean;
  preferredContactChannel: string;
  eventType: string;
  budgetRange: string;
  brief: string;
  leadSource: string;
  ownerStaffId: string;
  internalNotes: string;
};

export type CreateClientInput = ClientContactFields & { acknowledgedDuplicates: boolean };

export type ClientLifecycleRecord = { id: string; version: number; archivedAt: Date | null };
export type ClientIdentityConflict = {
  id: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  reason: "phone" | "email";
};

export type ClientRepository = {
  getDuplicateCandidates?(organizationId: string): Promise<DuplicateCandidate[]>;
  createClient?(input: ClientContactFields & { organizationId: string }): Promise<{ id: string }>;
  getClientLifecycle(organizationId: string, clientId: string): Promise<ClientLifecycleRecord | null>;
  findIdentityConflict(input: {
    organizationId: string;
    clientId: string;
    primaryPhoneNormalized: string;
    emailNormalized: string | null;
  }): Promise<ClientIdentityConflict | null>;
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

export type CreateClientResult =
  | { ok: true; clientId: string }
  | { ok: false; reason: "duplicates_not_acknowledged"; matches: DuplicateMatch[] };

export async function createClient(
  input: { actor: { organizationId: string; role: StaffRole }; client: CreateClientInput },
  repository: ClientRepository,
): Promise<CreateClientResult> {
  if (!input.client.fullName.trim()) throw new Error("Full name is required.");
  if (!input.client.primaryPhone.trim()) throw new Error("Primary phone is required.");
  if (!repository.getDuplicateCandidates || !repository.createClient) {
    throw new Error("Client creation is not available.");
  }

  const candidates = await repository.getDuplicateCandidates(input.actor.organizationId);
  const matches = findDuplicateMatches(
    {
      primaryPhoneNormalized: normalizePhone(input.client.primaryPhone),
      emailNormalized: input.client.email ? normalizeEmail(input.client.email) : null,
      nameNormalized: normalizeName(input.client.fullName),
    },
    candidates,
  );

  if (matches.length > 0 && !input.client.acknowledgedDuplicates) {
    return { ok: false, reason: "duplicates_not_acknowledged", matches };
  }

  const { acknowledgedDuplicates: _acknowledgedDuplicates, ...fields } = input.client;
  const created = await repository.createClient({
    organizationId: input.actor.organizationId,
    ...fields,
  });

  return { ok: true, clientId: created.id };
}

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
  const conflict = await repository.findIdentityConflict({
    organizationId: input.organizationId,
    clientId: input.clientId,
    primaryPhoneNormalized: normalizePhone(input.fields.primaryPhone),
    emailNormalized: input.fields.email ? normalizeEmail(input.fields.email) : null,
  });
  if (conflict) {
    throw new Error(
      conflict.reason === "phone"
        ? `Another Client already uses this phone number: ${conflict.fullName} (${conflict.primaryPhone}).`
        : `Another Client already uses this email address: ${conflict.fullName} (${conflict.email}).`,
    );
  }

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
