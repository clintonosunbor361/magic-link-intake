import { assertCanManageAccessoryItems, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";

// Accessory Sourcing is a module beside production, not inside it. An Accessory Item has no vendor
// assignment, no production status, no brief and no vendor payment ledger. A sourcing budget is
// metadata only; those boundaries are the whole point of the spec keeping this module separate.

type AccessorySourcingFields = {
  assignedToStaffId: string | null;
  supplier: string | null;
  budgetMinor: number | null;
  purchaseDate: string | null;
};

export type AccessoryItemRecord = { id: string; orderId: string; version: number; archivedAt: Date | null };

export type AccessoryItemRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  lookBelongsToOrder(organizationId: string, orderId: string, lookId: string): Promise<boolean>;
  typeIsSelectable(organizationId: string, accessoryTypeId: string): Promise<boolean>;
  statusIsSelectable(organizationId: string, accessoryStatusId: string): Promise<boolean>;
  staffIsActiveMember(organizationId: string, staffId: string): Promise<boolean>;
  getDefaultStatusId(organizationId: string): Promise<string | null>;
  createAccessoryItem(input: AccessorySourcingFields & {
    organizationId: string;
    orderId: string;
    lookId: string | null;
    accessoryTypeId: string;
    customLabel: string | null;
    accessoryStatusId: string;
    notes: string;
  }): Promise<{ id: string }>;
  getAccessoryItem(organizationId: string, accessoryItemId: string): Promise<AccessoryItemRecord | null>;
  updateAccessoryItem(input: AccessorySourcingFields & {
    organizationId: string;
    accessoryItemId: string;
    lookId: string | null;
    accessoryTypeId: string;
    customLabel: string | null;
    accessoryStatusId: string;
    notes: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    accessoryItemId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

async function assertSelectable(
  input: {
    organizationId: string;
    orderId: string;
    lookId: string | null;
    accessoryTypeId: string;
    accessoryStatusId: string;
    assignedToStaffId: string | null;
  },
  repository: AccessoryItemRepository,
) {
  if (!(await repository.orderBelongsToOrganization(input.organizationId, input.orderId))) {
    throw new Error("Order was not found.");
  }
  // A Look-scoped Accessory must name a Look on its own Order — otherwise it would inherit a date
  // from an event belonging to someone else's Order.
  if (input.lookId && !(await repository.lookBelongsToOrder(input.organizationId, input.orderId, input.lookId))) {
    throw new Error("Look was not found on this Order.");
  }
  if (!(await repository.typeIsSelectable(input.organizationId, input.accessoryTypeId))) {
    throw new Error("That accessory type is unavailable.");
  }
  if (!(await repository.statusIsSelectable(input.organizationId, input.accessoryStatusId))) {
    throw new Error("That accessory status is unavailable.");
  }
  if (
    input.assignedToStaffId &&
    !(await repository.staffIsActiveMember(input.organizationId, input.assignedToStaffId))
  ) {
    throw new Error("Assigned staff member is unavailable.");
  }
}

function normalizeSourcingFields(input: AccessorySourcingFields): AccessorySourcingFields {
  if (input.budgetMinor !== null && (!Number.isSafeInteger(input.budgetMinor) || input.budgetMinor < 0)) {
    throw new Error("Accessory budget cannot be negative and must use whole minor units.");
  }
  if (input.purchaseDate !== null && !isValidPurchaseDate(input.purchaseDate)) {
    throw new Error("Purchase date must use YYYY-MM-DD format.");
  }

  return {
    assignedToStaffId: input.assignedToStaffId,
    supplier: input.supplier?.trim() || null,
    budgetMinor: input.budgetMinor,
    purchaseDate: input.purchaseDate,
  };
}

function isValidPurchaseDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export async function createAccessoryItem(
  input: AccessorySourcingFields & {
    actor: { role: StaffRole };
    organizationId: string;
    orderId: string;
    lookId: string | null;
    accessoryTypeId: string;
    customLabel: string | null;
    accessoryStatusId: string | null;
    notes: string;
  },
  repository: AccessoryItemRepository,
) {
  assertCanManageAccessoryItems(input.actor.role);
  const sourcing = normalizeSourcingFields(input);

  // New accessories start at the first live status by sort order — "Not Started" in the seeded list,
  // though nothing here hardcodes that name.
  const statusId = input.accessoryStatusId ?? (await repository.getDefaultStatusId(input.organizationId));
  if (!statusId) throw new Error("No accessory statuses are configured. A Super Admin must add one first.");

  await assertSelectable({ ...input, accessoryStatusId: statusId }, repository);

  return repository.createAccessoryItem({
    organizationId: input.organizationId,
    orderId: input.orderId,
    lookId: input.lookId,
    accessoryTypeId: input.accessoryTypeId,
    customLabel: input.customLabel?.trim() || null,
    accessoryStatusId: statusId,
    ...sourcing,
    notes: input.notes.trim(),
  });
}

export async function updateAccessoryItem(
  input: AccessorySourcingFields & {
    actor: { role: StaffRole };
    organizationId: string;
    accessoryItemId: string;
    orderId: string;
    lookId: string | null;
    accessoryTypeId: string;
    customLabel: string | null;
    accessoryStatusId: string;
    notes: string;
    expectedVersion: number;
  },
  repository: AccessoryItemRepository,
) {
  assertCanManageAccessoryItems(input.actor.role);
  const sourcing = normalizeSourcingFields(input);
  await assertSelectable(input, repository);

  let existing: AccessoryItemRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      existing = await repository.getAccessoryItem(input.organizationId, input.accessoryItemId);
      return existing;
    },
    notFoundMessage: "Accessory was not found.",
    staleMessage: "This Accessory changed. Reload and try again.",
    persist: (nextVersion) => {
      if ((existing as AccessoryItemRecord).archivedAt) {
        throw new Error("An archived Accessory cannot be edited. Restore it first.");
      }
      return repository.updateAccessoryItem({
        organizationId: input.organizationId,
        accessoryItemId: input.accessoryItemId,
        lookId: input.lookId,
        accessoryTypeId: input.accessoryTypeId,
        customLabel: input.customLabel?.trim() || null,
        accessoryStatusId: input.accessoryStatusId,
        ...sourcing,
        notes: input.notes.trim(),
        expectedVersion: input.expectedVersion,
        nextVersion,
      });
    },
  });
}

/**
 * Cancellation and removal are archive/restore, following the Milestone 0 lifecycle policy — an
 * Accessory that was sourced and then called off is history worth keeping, not a row to delete.
 */
export async function archiveAccessoryItem(
  input: { actor: { role: StaffRole }; organizationId: string; accessoryItemId: string; expectedVersion: number },
  repository: AccessoryItemRepository,
) {
  if (!mayArchive("accessory_item", input.actor.role)) {
    throw new Error("You cannot archive this Accessory.");
  }
  return setArchivedState(input, true, repository);
}

export async function restoreAccessoryItem(
  input: { actor: { role: StaffRole }; organizationId: string; accessoryItemId: string; expectedVersion: number },
  repository: AccessoryItemRepository,
) {
  if (!mayRestore("accessory_item", input.actor.role)) {
    throw new Error("You cannot restore this Accessory.");
  }
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; accessoryItemId: string; expectedVersion: number },
  archived: boolean,
  repository: AccessoryItemRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getAccessoryItem(input.organizationId, input.accessoryItemId),
    notFoundMessage: "Accessory was not found.",
    staleMessage: "This Accessory changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        accessoryItemId: input.accessoryItemId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
