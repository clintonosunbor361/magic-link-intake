import { assertCanAssignVendors, type StaffRole } from "@/lib/domain/access-control";
import { assertBusinessDate } from "@/lib/domain/business-date";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import {
  type BulkAssignmentCandidate,
  describeBulkAssignment,
  planBulkAssignment,
} from "@/lib/production/bulk-assignment";

export type AssignmentLifecycleRecord = { id: string; version: number; itemId: string };

export type AssignmentRepository = {
  itemBelongsToOrganization(organizationId: string, itemId: string): Promise<boolean>;
  vendorIsAvailable(organizationId: string, vendorId: string): Promise<boolean>;
  getDefaultProductionStatusId(organizationId: string): Promise<string | null>;
  getLiveAssignmentForItem(organizationId: string, itemId: string): Promise<AssignmentLifecycleRecord | null>;
  getAssignment(organizationId: string, assignmentId: string): Promise<AssignmentLifecycleRecord | null>;
  listLookItemsForAssignment(organizationId: string, lookId: string): Promise<BulkAssignmentCandidate[]>;
  createAssignments(input: {
    organizationId: string;
    itemIds: string[];
    vendorId: string;
    productionStatusId: string;
    deadline: string;
    agreedVendorCostMinor: number | null;
    actorStaffId: string;
  }): Promise<{ ids: string[] }>;
  updateAssignmentTerms(input: {
    organizationId: string;
    assignmentId: string;
    deadline: string;
    agreedVendorCostMinor: number | null;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  replaceAssignment(input: {
    organizationId: string;
    assignmentId: string;
    itemId: string;
    vendorId: string;
    productionStatusId: string;
    deadline: string;
    agreedVendorCostMinor: number | null;
    expectedVersion: number;
    nextVersion: number;
    actorStaffId: string;
    reason: string;
  }): Promise<{ id: string }>;
};

type AssignmentTerms = {
  deadline: string;
  agreedVendorCostMinor: number | null;
};

function normalizeTerms(input: AssignmentTerms): AssignmentTerms {
  assertBusinessDate(input.deadline);
  if (input.agreedVendorCostMinor !== null) {
    if (!Number.isInteger(input.agreedVendorCostMinor) || input.agreedVendorCostMinor < 0) {
      throw new Error("Agreed Vendor cost must be a whole amount in minor units.");
    }
  }
  return input;
}

async function resolveDefaultStatus(organizationId: string, repository: AssignmentRepository): Promise<string> {
  const statusId = await repository.getDefaultProductionStatusId(organizationId);
  if (!statusId) {
    throw new Error("No production statuses are configured. Add one in Settings before assigning a Vendor.");
  }
  return statusId;
}

async function assertAssignable(
  input: { organizationId: string; vendorId: string },
  repository: AssignmentRepository,
) {
  if (!(await repository.vendorIsAvailable(input.organizationId, input.vendorId))) {
    throw new Error("Vendor was not found.");
  }
}

/**
 * Assign a single Item. Fails if the Item already has a live assignment — replacing one is
 * reassignment, which is a separate, deliberate action.
 */
export async function assignVendorToItem(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    itemId: string;
    vendorId: string;
  } & AssignmentTerms,
  repository: AssignmentRepository,
) {
  assertCanAssignVendors(input.actor.role);
  const terms = normalizeTerms(input);

  if (!(await repository.itemBelongsToOrganization(input.organizationId, input.itemId))) {
    throw new Error("Item was not found.");
  }
  await assertAssignable(input, repository);

  const existing = await repository.getLiveAssignmentForItem(input.organizationId, input.itemId);
  if (existing) throw new Error("This Item already has a Vendor. Reassign it from the assignment drawer.");

  const productionStatusId = await resolveDefaultStatus(input.organizationId, repository);
  const created = await repository.createAssignments({
    organizationId: input.organizationId,
    itemIds: [input.itemId],
    vendorId: input.vendorId,
    productionStatusId,
    deadline: terms.deadline,
    agreedVendorCostMinor: terms.agreedVendorCostMinor,
    actorStaffId: input.actor.staffId,
  });

  return { id: created.ids[0] };
}

/**
 * Look-level bulk assignment. Assigns every unassigned Item in the Look and reports the ones it
 * skipped — it never replaces an existing assignment, because replacing archives that Vendor's
 * production history and resets status.
 */
export async function bulkAssignVendorToLook(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    lookId: string;
    vendorId: string;
  } & AssignmentTerms,
  repository: AssignmentRepository,
) {
  assertCanAssignVendors(input.actor.role);
  const terms = normalizeTerms(input);
  await assertAssignable(input, repository);

  const candidates = await repository.listLookItemsForAssignment(input.organizationId, input.lookId);
  if (!candidates.length) throw new Error("This Look has no Items to assign.");

  const plan = planBulkAssignment(candidates);
  if (!plan.assignItemIds.length) {
    return { assignedCount: 0, plan, message: describeBulkAssignment(plan) };
  }

  const productionStatusId = await resolveDefaultStatus(input.organizationId, repository);
  // A single transaction in the repository: either every unassigned Item in the Look gets its
  // assignment and initial status-history row, or none does.
  const created = await repository.createAssignments({
    organizationId: input.organizationId,
    itemIds: plan.assignItemIds,
    vendorId: input.vendorId,
    productionStatusId,
    deadline: terms.deadline,
    agreedVendorCostMinor: terms.agreedVendorCostMinor,
    actorStaffId: input.actor.staffId,
  });

  return { assignedCount: created.ids.length, plan, message: describeBulkAssignment(plan) };
}

/** Deadline and agreed cost can be corrected in place — neither changes who the work belongs to. */
export async function updateAssignmentTerms(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    assignmentId: string;
    expectedVersion: number;
  } & AssignmentTerms,
  repository: AssignmentRepository,
) {
  assertCanAssignVendors(input.actor.role);
  const terms = normalizeTerms(input);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getAssignment(input.organizationId, input.assignmentId),
    notFoundMessage: "Vendor assignment was not found.",
    staleMessage: "This assignment changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateAssignmentTerms({
        organizationId: input.organizationId,
        assignmentId: input.assignmentId,
        deadline: terms.deadline,
        agreedVendorCostMinor: terms.agreedVendorCostMinor,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

/**
 * Reassignment archives the current assignment and inserts a fresh one for the new Vendor. Nothing
 * is carried across: the outgoing Vendor keeps their own status history, production notes, brief
 * export record and (from Milestone 6) payment records, and the incoming Vendor starts at the
 * default status with a clean history.
 *
 * The deadline is prefilled by the caller because it is a commitment to the client; the agreed cost
 * is not, because it was negotiated with the Vendor being replaced.
 */
export async function reassignVendor(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    assignmentId: string;
    vendorId: string;
    expectedVersion: number;
    reason: string;
  } & AssignmentTerms,
  repository: AssignmentRepository,
) {
  assertCanAssignVendors(input.actor.role);
  const terms = normalizeTerms(input);
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to reassign this Item to another Vendor.");
  await assertAssignable(input, repository);

  const current = await repository.getAssignment(input.organizationId, input.assignmentId);
  if (!current) throw new Error("Vendor assignment was not found.");

  const productionStatusId = await resolveDefaultStatus(input.organizationId, repository);
  let replacement: { id: string } | null = null;

  await resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => current,
    notFoundMessage: "Vendor assignment was not found.",
    staleMessage: "This assignment changed. Reload and try again.",
    persist: async (nextVersion) => {
      replacement = await repository.replaceAssignment({
        organizationId: input.organizationId,
        assignmentId: input.assignmentId,
        itemId: current.itemId,
        vendorId: input.vendorId,
        productionStatusId,
        deadline: terms.deadline,
        agreedVendorCostMinor: terms.agreedVendorCostMinor,
        expectedVersion: input.expectedVersion,
        nextVersion,
        actorStaffId: input.actor.staffId,
        reason,
      });
    },
  });

  if (!replacement) throw new Error("The Item could not be reassigned.");
  return replacement as { id: string };
}
