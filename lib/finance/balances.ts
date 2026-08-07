// The two balance formulas in the spec, isolated as pure integer arithmetic:
//
//   Order balance  = total invoiced       - total client payments
//   Vendor balance = agreed vendor cost   - vendor payments
//
// Milestone 5 has no invoices and no payment records yet — those arrive with Milestone 6 — so the
// callers here feed `invoicedMinor: null` and `paidMinor: 0` from repositories that have nothing to
// read. That is deliberate: the arithmetic and its display rules are settled and tested now, and
// Milestone 6 changes only where the numbers come from, not what they mean.
//
// The distinction these types enforce is "absent" vs "zero". An Order with no invoice has an
// unknown balance, not a balance of ₦0, and the UI must say so rather than render a number that
// looks settled.

export type OrderBalance =
  | { state: "not_invoiced" }
  | { state: "invoiced"; invoicedMinor: number; paidMinor: number; balanceMinor: number };

export function computeOrderBalance(input: {
  invoicedMinor: number | null;
  paidMinor: number;
}): OrderBalance {
  if (input.invoicedMinor === null) return { state: "not_invoiced" };

  return {
    state: "invoiced",
    invoicedMinor: input.invoicedMinor,
    paidMinor: input.paidMinor,
    balanceMinor: input.invoicedMinor - input.paidMinor,
  };
}

export type VendorPaymentPosition =
  | { state: "no_agreed_cost" }
  | { state: "agreed"; agreedCostMinor: number; paidMinor: number; owedMinor: number };

export function computeVendorPaymentPosition(input: {
  agreedCostMinor: number | null;
  paidMinor: number;
}): VendorPaymentPosition {
  if (input.agreedCostMinor === null) return { state: "no_agreed_cost" };

  return {
    state: "agreed",
    agreedCostMinor: input.agreedCostMinor,
    paidMinor: input.paidMinor,
    owedMinor: input.agreedCostMinor - input.paidMinor,
  };
}

/**
 * The payment gate from the spec: an Order with a positive client balance cannot be marked
 * delivered/completed unless a Super Admin supplies an audited reason. Milestone 6 owns the
 * delivery action itself; this predicate is the rule it will call, defined once here alongside the
 * arithmetic it depends on.
 *
 * An uninvoiced Order is treated as blocking — nothing has been billed, so nothing can have been
 * settled.
 */
export function blocksOrderCompletion(balance: OrderBalance): boolean {
  return balance.state === "not_invoiced" || balance.balanceMinor > 0;
}
