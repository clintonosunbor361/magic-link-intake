import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type ConsultationNoteFields = { sourceId: string; body: string; occurredAt: Date | null };

export type ConsultationNoteEditRecord = {
  id: string;
  version: number;
  body: string;
  sourceId: string;
  occurredAt: Date | null;
  createdByStaffId: string;
  createdAt: Date;
  lastEditedByStaffId: string | null;
  lastEditedAt: Date | null;
};

export type ConsultationNoteLifecycleRecord = { id: string; version: number };

export type ConsultationNoteRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  lookBelongsToOrder(organizationId: string, orderId: string, lookId: string): Promise<boolean>;
  sourceBelongsToOrganization(organizationId: string, sourceId: string): Promise<boolean>;
  createConsultationNote(
    input: ConsultationNoteFields & {
      organizationId: string;
      orderId: string;
      lookId: string | null;
      createdByStaffId: string;
    },
  ): Promise<{ id: string }>;
  getConsultationNoteForEdit(organizationId: string, noteId: string): Promise<ConsultationNoteEditRecord | null>;
  updateConsultationNoteWithHistory(input: {
    organizationId: string;
    noteId: string;
    expectedVersion: number;
    nextVersion: number;
    fields: ConsultationNoteFields;
    editedByStaffId: string;
    priorSnapshot: {
      body: string;
      sourceId: string;
      occurredAt: Date | null;
      authorStaffId: string;
      authoredAt: Date;
    };
  }): Promise<void>;
  getConsultationNoteLifecycle(organizationId: string, noteId: string): Promise<ConsultationNoteLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    noteId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createConsultationNote(
  input: {
    organizationId: string;
    orderId: string;
    lookId: string | null;
    fields: ConsultationNoteFields;
    createdByStaffId: string;
  },
  repository: ConsultationNoteRepository,
) {
  if (!input.fields.body.trim()) throw new Error("Note body is required.");

  const orderOk = await repository.orderBelongsToOrganization(input.organizationId, input.orderId);
  if (!orderOk) throw new Error("Order was not found.");

  if (input.lookId) {
    const lookOk = await repository.lookBelongsToOrder(input.organizationId, input.orderId, input.lookId);
    if (!lookOk) throw new Error("Look was not found.");
  }

  const sourceOk = await repository.sourceBelongsToOrganization(input.organizationId, input.fields.sourceId);
  if (!sourceOk) throw new Error("Source was not found.");

  return repository.createConsultationNote({
    organizationId: input.organizationId,
    orderId: input.orderId,
    lookId: input.lookId,
    createdByStaffId: input.createdByStaffId,
    ...input.fields,
  });
}

export async function updateConsultationNoteWithHistory(
  input: {
    organizationId: string;
    noteId: string;
    expectedVersion: number;
    fields: ConsultationNoteFields;
    editedByStaffId: string;
  },
  repository: ConsultationNoteRepository,
) {
  if (!input.fields.body.trim()) throw new Error("Note body is required.");

  const sourceOk = await repository.sourceBelongsToOrganization(input.organizationId, input.fields.sourceId);
  if (!sourceOk) throw new Error("Source was not found.");

  let fetched: ConsultationNoteEditRecord | null = null;

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      fetched = await repository.getConsultationNoteForEdit(input.organizationId, input.noteId);
      return fetched;
    },
    notFoundMessage: "Consultation Note was not found.",
    staleMessage: "This Consultation Note changed. Reload and try again.",
    persist: (nextVersion) => {
      const current = fetched as ConsultationNoteEditRecord;
      return repository.updateConsultationNoteWithHistory({
        organizationId: input.organizationId,
        noteId: input.noteId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        fields: input.fields,
        editedByStaffId: input.editedByStaffId,
        priorSnapshot: {
          body: current.body,
          sourceId: current.sourceId,
          occurredAt: current.occurredAt,
          authorStaffId: current.lastEditedByStaffId ?? current.createdByStaffId,
          authoredAt: current.lastEditedAt ?? current.createdAt,
        },
      });
    },
  });
}

export async function archiveConsultationNote(
  input: { actor: { organizationId: string; role: StaffRole }; noteId: string; expectedVersion: number },
  repository: ConsultationNoteRepository,
) {
  if (!mayArchive("consultation_note", input.actor.role)) throw new Error("You cannot archive this Consultation Note.");
  return setArchivedState(input, true, repository);
}

export async function restoreConsultationNote(
  input: { actor: { organizationId: string; role: StaffRole }; noteId: string; expectedVersion: number },
  repository: ConsultationNoteRepository,
) {
  if (!mayRestore("consultation_note", input.actor.role)) throw new Error("You cannot restore this Consultation Note.");
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; noteId: string; expectedVersion: number },
  archived: boolean,
  repository: ConsultationNoteRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getConsultationNoteLifecycle(input.actor.organizationId, input.noteId),
    notFoundMessage: "Consultation Note was not found.",
    staleMessage: "This Consultation Note changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        noteId: input.noteId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
