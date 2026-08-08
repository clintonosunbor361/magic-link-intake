import { canOverrideCompletionGate, type StaffRole } from "@/lib/domain/access-control";
import { blocksOrderCompletion, type OrderBalance } from "@/lib/finance/balances";

// The payment gate, decided in one place so the button, the server action and the tests all read the
// same rule. blocksOrderCompletion (lib/finance/balances) owns the arithmetic half; this owns who
// may bypass it and on what terms.

export type CompletionDecision = { blocked: boolean; overrideReason: string | null };

/**
 * An Order with a positive client balance cannot be completed. A Super Admin may override with a
 * non-empty reason, which is recorded on the Order and in the audit log — an unexplained override
 * is the thing this is designed to make impossible.
 *
 * An Order that was never invoiced counts as blocked: nothing has been billed, so nothing can have
 * been settled.
 */
export function decideOrderCompletion(input: {
  balance: OrderBalance;
  role: StaffRole;
  overrideReason: string | null;
}): CompletionDecision {
  const blocked = blocksOrderCompletion(input.balance);
  if (!blocked) return { blocked: false, overrideReason: null };

  if (!canOverrideCompletionGate(input.role)) {
    throw new Error(
      "This Order still has an outstanding client balance. A Super Admin must override to complete it.",
    );
  }

  const reason = (input.overrideReason ?? "").trim();
  if (!reason) throw new Error("A reason is required to complete an Order with an outstanding balance.");

  return { blocked: true, overrideReason: reason };
}

export function describeCompletionForAudit(decision: CompletionDecision): string {
  return decision.overrideReason
    ? `Completed the Order with an outstanding client balance. Reason: ${decision.overrideReason}`
    : "Completed the Order.";
}
