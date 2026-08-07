import { assertCanAssignVendors, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

// Every status change writes a history row — previous status, new status, actor, time, and an
// optional note. That is automatic and not a separate user action, so the evidence cannot be
// skipped by whoever is in a hurry. Deadline changes deliberately do not get history entries in
// Phase 1.

export type AssignmentStatusRecord = { id: string; version: number; productionStatusId: string };

export type ProductionStatusChangeRepository = {
  getAssignmentStatus(organizationId: string, assignmentId: string): Promise<AssignmentStatusRecord | null>;
  statusIsSelectable(organizationId: string, statusId: string): Promise<boolean>;
  applyStatusChange(input: {
    organizationId: string;
    assignmentId: string;
    previousStatusId: string;
    newStatusId: string;
    note: string | null;
    actorStaffId: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function changeProductionStatus(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    assignmentId: string;
    newStatusId: string;
    note: string | null;
    expectedVersion: number;
  },
  repository: ProductionStatusChangeRepository,
) {
  // Selecting a status is operational work: both roles may do it. Managing which statuses exist is
  // Super Admin only, and lives in the production-statuses service.
  assertCanAssignVendors(input.actor.role);

  if (!(await repository.statusIsSelectable(input.organizationId, input.newStatusId))) {
    throw new Error("That production status is unavailable.");
  }

  const current = await repository.getAssignmentStatus(input.organizationId, input.assignmentId);
  if (!current) throw new Error("Vendor assignment was not found.");
  if (current.productionStatusId === input.newStatusId) {
    throw new Error("This assignment is already at that status.");
  }

  const note = (input.note ?? "").trim();

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => current,
    notFoundMessage: "Vendor assignment was not found.",
    staleMessage: "This assignment changed. Reload and try again.",
    // The status update and its history row are written together in the repository, so a status can
    // never move without leaving evidence of who moved it.
    persist: (nextVersion) =>
      repository.applyStatusChange({
        organizationId: input.organizationId,
        assignmentId: input.assignmentId,
        previousStatusId: current.productionStatusId,
        newStatusId: input.newStatusId,
        note: note.length ? note : null,
        actorStaffId: input.actor.staffId,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

export type ProductionNoteRepository = {
  assignmentBelongsToOrganization(organizationId: string, assignmentId: string): Promise<boolean>;
  createProductionNote(input: {
    organizationId: string;
    assignmentId: string;
    note: string;
    actorStaffId: string;
  }): Promise<{ id: string }>;
};

/**
 * Production notes are internal: they never appear on a client-facing page and are never offered to
 * the Vendor Brief builder. Consultation notes are the brief-eligible kind.
 */
export async function addProductionNote(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    assignmentId: string;
    note: string;
  },
  repository: ProductionNoteRepository,
) {
  assertCanAssignVendors(input.actor.role);
  const note = input.note.trim();
  if (!note) throw new Error("A note is required.");

  if (!(await repository.assignmentBelongsToOrganization(input.organizationId, input.assignmentId))) {
    throw new Error("Vendor assignment was not found.");
  }

  return repository.createProductionNote({
    organizationId: input.organizationId,
    assignmentId: input.assignmentId,
    note,
    actorStaffId: input.actor.staffId,
  });
}
