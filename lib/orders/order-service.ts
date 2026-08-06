import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type OrderFields = {
  title: string;
  eventType: string;
  finalAgreedPriceMinor: number;
  ffDiscount: boolean;
  ffDiscountAmountMinor: number | null;
};

export type OrderLifecycleRecord = { id: string; version: number; archivedAt: Date | null };

export type OrderRepository = {
  getOrderLifecycle(organizationId: string, orderId: string): Promise<OrderLifecycleRecord | null>;
  updateOrderDetails(
    input: OrderFields & {
      organizationId: string;
      orderId: string;
      expectedVersion: number;
      nextVersion: number;
    },
  ): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    orderId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function updateOrderDetails(
  input: { organizationId: string; orderId: string; expectedVersion: number; fields: OrderFields },
  repository: OrderRepository,
) {
  if (!input.fields.title.trim()) throw new Error("Order title is required.");
  if (!input.fields.eventType.trim()) throw new Error("Event type is required.");
  if (!Number.isInteger(input.fields.finalAgreedPriceMinor) || input.fields.finalAgreedPriceMinor <= 0) {
    throw new Error("Final agreed price must be greater than zero.");
  }

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getOrderLifecycle(input.organizationId, input.orderId),
    notFoundMessage: "Order was not found.",
    staleMessage: "This Order changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateOrderDetails({
        organizationId: input.organizationId,
        orderId: input.orderId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        ...input.fields,
      }),
  });
}

export async function archiveOrder(
  input: { actor: { organizationId: string; role: StaffRole }; orderId: string; expectedVersion: number },
  repository: OrderRepository,
) {
  if (!mayArchive("order", input.actor.role)) throw new Error("You cannot archive this Order.");
  return setArchivedState(input, true, repository);
}

export async function restoreOrder(
  input: { actor: { organizationId: string; role: StaffRole }; orderId: string; expectedVersion: number },
  repository: OrderRepository,
) {
  if (!mayRestore("order", input.actor.role)) throw new Error("You cannot restore this Order.");
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; orderId: string; expectedVersion: number },
  archived: boolean,
  repository: OrderRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getOrderLifecycle(input.actor.organizationId, input.orderId),
    notFoundMessage: "Order was not found.",
    staleMessage: "This Order changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        orderId: input.orderId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
