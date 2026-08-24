import { assertCanManageLeadSources, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

export type LeadSourceLifecycleRecord = { id: string; version: number };

export type LeadSourceRepository = {
  createLeadSource(input: { organizationId: string; name: string; sortOrder: number }): Promise<{ id: string }>;
  getLeadSource(organizationId: string, leadSourceId: string): Promise<LeadSourceLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    leadSourceId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createLeadSource(
  input: { actor: { role: StaffRole }; organizationId: string; name: string; sortOrder: number },
  repository: LeadSourceRepository,
) {
  assertCanManageLeadSources(input.actor.role);
  if (!input.name.trim()) throw new Error("Lead source name is required.");

  const created = await repository.createLeadSource({
    organizationId: input.organizationId,
    name: input.name.trim(),
    sortOrder: input.sortOrder,
  });
  return { id: created.id };
}

export async function archiveLeadSource(
  input: { actor: { role: StaffRole }; organizationId: string; leadSourceId: string; expectedVersion: number },
  repository: LeadSourceRepository,
) {
  assertCanManageLeadSources(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreLeadSource(
  input: { actor: { role: StaffRole }; organizationId: string; leadSourceId: string; expectedVersion: number },
  repository: LeadSourceRepository,
) {
  assertCanManageLeadSources(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; leadSourceId: string; expectedVersion: number },
  archived: boolean,
  repository: LeadSourceRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getLeadSource(input.organizationId, input.leadSourceId),
    notFoundMessage: "Lead Source was not found.",
    staleMessage: "This Lead Source changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        leadSourceId: input.leadSourceId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
