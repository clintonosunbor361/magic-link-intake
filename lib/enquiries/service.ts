import type { DuplicateCandidate, DuplicateMatch } from "@/lib/enquiries/duplicate-match";
import { findDuplicateMatches, normalizeEmail, normalizeName, normalizePhone } from "@/lib/enquiries/duplicate-match";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type InternalEnquiryFields = {
  fullName: string;
  primaryPhone: string;
  whatsappSameAsPrimary: boolean;
  whatsappPhone: string;
  email: string;
  preferredContactChannel: string;
  eventType: string;
  budgetRange: string;
  brief: string;
  leadSource: string;
  ownerStaffId: string;
  internalNotes: string;
  linkedClientId: string | null;
};

export type InternalEnquiryInput = InternalEnquiryFields & { acknowledgedDuplicates: boolean };

export type EnquiryLifecycleRecord = { id: string; version: number; archivedAt: Date | null };
export type EditableEnquiryRecord = EnquiryLifecycleRecord & { convertedAt: Date | null };

export type EnquiryRepository = {
  getDuplicateCandidates(organizationId: string): Promise<DuplicateCandidate[]>;
  createInternalEnquiry(
    input: InternalEnquiryFields & { organizationId: string },
  ): Promise<{ id: string }>;
  clientBelongsToOrganization?(organizationId: string, clientId: string): Promise<boolean>;
  getEnquiryLifecycle(organizationId: string, enquiryId: string): Promise<EnquiryLifecycleRecord | null>;
  getEditableEnquiry(organizationId: string, enquiryId: string): Promise<EditableEnquiryRecord | null>;
  updateEnquiryDetails(
    input: InternalEnquiryFields & {
      organizationId: string;
      enquiryId: string;
      expectedVersion: number;
      nextVersion: number;
    },
  ): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    enquiryId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export type CreateInternalEnquiryResult =
  | { ok: true; enquiryId: string }
  | { ok: false; reason: "duplicates_not_acknowledged"; matches: DuplicateMatch[] };

export async function createInternalEnquiry(
  input: { actor: { organizationId: string; role: StaffRole }; enquiry: InternalEnquiryInput },
  repository: EnquiryRepository,
): Promise<CreateInternalEnquiryResult> {
  if (!input.enquiry.fullName.trim()) throw new Error("Full name is required.");
  if (!input.enquiry.primaryPhone.trim()) throw new Error("Primary phone is required.");
  if (
    input.enquiry.linkedClientId &&
    (!repository.clientBelongsToOrganization ||
      !(await repository.clientBelongsToOrganization(input.actor.organizationId, input.enquiry.linkedClientId)))
  ) {
    throw new Error("Client was not found.");
  }

  const candidates = await repository.getDuplicateCandidates(input.actor.organizationId);
  const matches = findDuplicateMatches(
    {
      primaryPhoneNormalized: normalizePhone(input.enquiry.primaryPhone),
      emailNormalized: input.enquiry.email ? normalizeEmail(input.enquiry.email) : null,
      nameNormalized: normalizeName(input.enquiry.fullName),
    },
    candidates,
  );

  if (matches.length > 0 && !input.enquiry.acknowledgedDuplicates) {
    return { ok: false, reason: "duplicates_not_acknowledged", matches };
  }

  const { acknowledgedDuplicates: _acknowledgedDuplicates, ...fields } = input.enquiry;
  const created = await repository.createInternalEnquiry({
    organizationId: input.actor.organizationId,
    ...fields,
  });

  return { ok: true, enquiryId: created.id };
}

export async function updateEnquiryDetails(
  input: {
    actor: { organizationId: string; role: StaffRole };
    enquiryId: string;
    expectedVersion: number;
    fields: InternalEnquiryFields;
  },
  repository: EnquiryRepository,
) {
  if (!input.fields.fullName.trim()) throw new Error("Full name is required.");
  if (!input.fields.primaryPhone.trim()) throw new Error("Primary phone is required.");
  if (
    input.fields.linkedClientId &&
    (!repository.clientBelongsToOrganization ||
      !(await repository.clientBelongsToOrganization(input.actor.organizationId, input.fields.linkedClientId)))
  ) {
    throw new Error("Client was not found.");
  }

  const candidates = await repository.getDuplicateCandidates(input.actor.organizationId);
  const matches = findDuplicateMatches(
    {
      primaryPhoneNormalized: normalizePhone(input.fields.primaryPhone),
      emailNormalized: input.fields.email ? normalizeEmail(input.fields.email) : null,
      nameNormalized: normalizeName(input.fields.fullName),
    },
    candidates.filter((candidate) => !(candidate.kind === "enquiry" && candidate.id === input.enquiryId)),
  );
  const strongMatch = matches.find((match) => match.strength === "strong");
  if (strongMatch) {
    throw new Error(
      strongMatch.reason === "phone"
        ? `Another ${strongMatch.candidate.kind === "client" ? "Client" : "Enquiry"} already uses this phone number: ${strongMatch.candidate.fullName} (${strongMatch.candidate.primaryPhone}).`
        : `Another ${strongMatch.candidate.kind === "client" ? "Client" : "Enquiry"} already uses this email address: ${strongMatch.candidate.fullName} (${strongMatch.candidate.email}).`,
    );
  }

  const current = await repository.getEditableEnquiry(input.actor.organizationId, input.enquiryId);
  if (!current) throw new Error("Enquiry was not found.");
  if (current.archivedAt) throw new Error("Restore this Enquiry before editing it.");
  if (current.convertedAt) throw new Error("Converted Enquiries cannot be edited.");

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => current,
    notFoundMessage: "Enquiry was not found.",
    staleMessage: "This Enquiry changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateEnquiryDetails({
        organizationId: input.actor.organizationId,
        enquiryId: input.enquiryId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        ...input.fields,
      }),
  });
}

export async function archiveEnquiry(
  input: { actor: { organizationId: string; role: StaffRole }; enquiryId: string; expectedVersion: number },
  repository: EnquiryRepository,
) {
  if (!mayArchive("enquiry", input.actor.role)) throw new Error("You cannot archive this Enquiry.");
  return setArchivedState(input, true, repository);
}

export async function restoreEnquiry(
  input: { actor: { organizationId: string; role: StaffRole }; enquiryId: string; expectedVersion: number },
  repository: EnquiryRepository,
) {
  if (!mayRestore("enquiry", input.actor.role)) throw new Error("You cannot restore this Enquiry.");
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; enquiryId: string; expectedVersion: number },
  archived: boolean,
  repository: EnquiryRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getEnquiryLifecycle(input.actor.organizationId, input.enquiryId),
    notFoundMessage: "Enquiry was not found.",
    staleMessage: "This Enquiry changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        enquiryId: input.enquiryId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
