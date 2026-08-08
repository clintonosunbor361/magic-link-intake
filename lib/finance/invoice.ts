import type { OrderBalance } from "@/lib/finance/balances";

// Everything an Invoice knows about itself that is not a database read. All integer minor units:
// quantity × unit price never leaves integer arithmetic, so a total cannot drift by a kobo.

export const INVOICE_STATUSES = ["draft", "sent", "part_paid", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** The three states staff move an Invoice through by hand. The other two are derived. */
export type InvoiceLifecycleStatus = "draft" | "sent" | "void";

export type InvoiceLineItemInput = { description: string; quantity: number; unitPriceMinor: number };

export function computeLineAmountMinor(line: { quantity: number; unitPriceMinor: number }): number {
  return line.quantity * line.unitPriceMinor;
}

export function computeInvoiceTotalMinor(lines: readonly { quantity: number; unitPriceMinor: number }[]): number {
  return lines.reduce((total, line) => total + computeLineAmountMinor(line), 0);
}

export function formatInvoiceNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(4, "0")}`;
}

/**
 * Part Paid and Paid are read off the balance, never set by hand: an Invoice cannot sit at "Sent"
 * after the client has cleared it, and cannot claim to be Paid while money is outstanding.
 *
 * Draft and Void win over any payment position — a voided Invoice reads as Void even if payments
 * were recorded against it before it was voided, and those payments stay visible as a mismatch.
 */
export function deriveInvoiceStatus(input: {
  lifecycle: InvoiceLifecycleStatus;
  balance: OrderBalance;
}): InvoiceStatus {
  if (input.lifecycle !== "sent") return input.lifecycle;
  if (input.balance.state === "not_invoiced") return "sent";

  const { paidMinor, balanceMinor } = input.balance;
  if (paidMinor <= 0) return "sent";
  // An overpaid Invoice is Paid, not Part Paid — the overpayment is surfaced separately.
  return balanceMinor <= 0 ? "paid" : "part_paid";
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  part_paid: "Part Paid",
  paid: "Paid",
  void: "Void",
};

export type PaymentMismatch =
  | { kind: "overpaid"; excessMinor: number }
  | { kind: "paid_against_void" }
  | { kind: "paid_against_draft" };

/**
 * Ticket 28 asks for mismatches to be surfaced rather than silently normalized, so nothing here
 * rejects or clamps anything: real money moved, and the record must be able to say so. These are
 * things a human should look at, not errors.
 */
export function detectPaymentMismatches(input: {
  lifecycle: InvoiceLifecycleStatus;
  balance: OrderBalance;
}): PaymentMismatch[] {
  const mismatches: PaymentMismatch[] = [];
  if (input.balance.state !== "invoiced") return mismatches;

  if (input.balance.paidMinor > 0 && input.lifecycle === "void") mismatches.push({ kind: "paid_against_void" });
  if (input.balance.paidMinor > 0 && input.lifecycle === "draft") mismatches.push({ kind: "paid_against_draft" });
  if (input.balance.balanceMinor < 0) {
    mismatches.push({ kind: "overpaid", excessMinor: -input.balance.balanceMinor });
  }

  return mismatches;
}

export function assertValidLineItem(line: InvoiceLineItemInput): void {
  if (!line.description.trim()) throw new Error("Each line item needs a description.");
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new Error("Quantity must be a whole number of at least 1.");
  }
  if (!Number.isInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
    throw new Error("Unit price cannot be negative.");
  }
}

/**
 * Line items are editable while an Invoice is a Draft and frozen once it has been sent: the client
 * is holding a PDF of those figures, and changing them underneath would make the document a lie.
 * Corrections after sending go through voiding.
 */
export function assertLineItemsEditable(lifecycle: InvoiceLifecycleStatus): void {
  if (lifecycle === "sent") throw new Error("A sent Invoice cannot be edited. Void it to correct the figures.");
  if (lifecycle === "void") throw new Error("A voided Invoice cannot be edited.");
}

export function assertSendable(lifecycle: InvoiceLifecycleStatus, lineCount: number): void {
  if (lifecycle === "void") throw new Error("A voided Invoice cannot be sent.");
  if (lifecycle === "sent") throw new Error("This Invoice has already been sent.");
  if (lineCount < 1) throw new Error("Add at least one line item before sending this Invoice.");
}

export function assertVoidable(lifecycle: InvoiceLifecycleStatus, reason: string): void {
  if (lifecycle === "void") throw new Error("This Invoice is already void.");
  if (!reason.trim()) throw new Error("A reason is required to void an Invoice.");
}
