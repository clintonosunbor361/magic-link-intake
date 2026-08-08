import type { StaffRole } from "@/lib/domain/access-control";
import { computeOrderBalance } from "@/lib/finance/balances";
import { type CompletionDecision, decideOrderCompletion, describeCompletionForAudit } from "@/lib/finance/completion";

export type OrderCompletionRecord = {
  id: string;
  version: number;
  completedAt: Date | null;
  archivedAt: Date | null;
  invoicedMinor: number | null;
  paidMinor: number;
};

export type OrderCompletionRepository = {
  getOrderForCompletion(organizationId: string, orderId: string): Promise<OrderCompletionRecord | null>;
  completeOrder(input: {
    organizationId: string;
    orderId: string;
    expectedVersion: number;
    nextVersion: number;
    completedAt: Date;
    actorStaffId: string;
    overrideReason: string | null;
    auditSummary: string;
  }): Promise<void>;
};

/**
 * Completing an already-completed Order is a no-op rather than an error: the action is idempotent,
 * so a double submit or a retried request cannot produce a second completion or a second audit
 * entry. The balance is re-read here server-side, so a stale page cannot talk its way past the gate.
 */
export async function completeOrder(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    orderId: string;
    overrideReason: string | null;
    completedAt?: Date;
  },
  repository: OrderCompletionRepository,
): Promise<{ alreadyCompleted: boolean; decision: CompletionDecision | null }> {
  const order = await repository.getOrderForCompletion(input.organizationId, input.orderId);
  if (!order) throw new Error("Order was not found.");
  if (order.completedAt) return { alreadyCompleted: true, decision: null };
  if (order.archivedAt) throw new Error("An archived Order cannot be completed.");

  const balance = computeOrderBalance({ invoicedMinor: order.invoicedMinor, paidMinor: order.paidMinor });
  const decision = decideOrderCompletion({
    balance,
    role: input.actor.role,
    overrideReason: input.overrideReason,
  });

  await repository.completeOrder({
    organizationId: input.organizationId,
    orderId: input.orderId,
    expectedVersion: order.version,
    nextVersion: order.version + 1,
    completedAt: input.completedAt ?? new Date(),
    actorStaffId: input.actor.staffId,
    overrideReason: decision.overrideReason,
    auditSummary: describeCompletionForAudit(decision),
  });

  return { alreadyCompleted: false, decision };
}
