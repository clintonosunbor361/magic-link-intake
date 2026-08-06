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
};

export type InternalEnquiryInput = InternalEnquiryFields & { acknowledgedDuplicates: boolean };

export type EnquiryLifecycleRecord = { id: string; version: number; archivedAt: Date | null };

export type EnquiryRepository = {
  getDuplicateCandidates(organizationId: string): Promise<DuplicateCandidate[]>;
  createInternalEnquiry(
    input: InternalEnquiryFields & { organizationId: string },
  ): Promise<{ id: string }>;
  getEnquiryLifecycle(organizationId: string, enquiryId: string): Promise<EnquiryLifecycleRecord | null>;
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
