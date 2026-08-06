import { assertCanManageConsultationNoteSources, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

export type ConsultationNoteSourceLifecycleRecord = { id: string; version: number };

export type ConsultationNoteSourceRepository = {
  createConsultationNoteSource(input: { organizationId: string; name: string; sortOrder: number }): Promise<{ id: string }>;
  getConsultationNoteSource(organizationId: string, sourceId: string): Promise<ConsultationNoteSourceLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    sourceId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createConsultationNoteSource(
  input: { actor: { role: StaffRole }; organizationId: string; name: string; sortOrder: number },
  repository: ConsultationNoteSourceRepository,
) {
  assertCanManageConsultationNoteSources(input.actor.role);
  if (!input.name.trim()) throw new Error("Source name is required.");

  const created = await repository.createConsultationNoteSource({
    organizationId: input.organizationId,
    name: input.name.trim(),
    sortOrder: input.sortOrder,
  });
  return { id: created.id };
}

export async function archiveConsultationNoteSource(
  input: { actor: { role: StaffRole }; organizationId: string; sourceId: string; expectedVersion: number },
  repository: ConsultationNoteSourceRepository,
) {
  assertCanManageConsultationNoteSources(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreConsultationNoteSource(
  input: { actor: { role: StaffRole }; organizationId: string; sourceId: string; expectedVersion: number },
  repository: ConsultationNoteSourceRepository,
) {
  assertCanManageConsultationNoteSources(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; sourceId: string; expectedVersion: number },
  archived: boolean,
  repository: ConsultationNoteSourceRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getConsultationNoteSource(input.organizationId, input.sourceId),
    notFoundMessage: "Source was not found.",
    staleMessage: "This Source changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        sourceId: input.sourceId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
