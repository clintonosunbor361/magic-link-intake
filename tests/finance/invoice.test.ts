import { describe, expect, it } from "vitest";
import { computeOrderBalance } from "@/lib/finance/balances";
import {
  assertLineItemsEditable,
  assertSendable,
  assertValidLineItem,
  assertVoidable,
  computeInvoiceTotalMinor,
  computeLineAmountMinor,
  deriveInvoiceStatus,
  detectPaymentMismatches,
  formatInvoiceNumber,
} from "@/lib/finance/invoice";

describe("invoice totals", () => {
  it("multiplies quantity by unit price in integer minor units", () => {
    expect(computeLineAmountMinor({ quantity: 3, unitPriceMinor: 45_000_00 })).toBe(135_000_00);
  });

  it("sums line amounts without floating-point drift", () => {
    // Three lines that would each land on a repeating decimal in naira arithmetic.
    const total = computeInvoiceTotalMinor([
      { quantity: 3, unitPriceMinor: 33_333_33 },
      { quantity: 1, unitPriceMinor: 10 },
      { quantity: 7, unitPriceMinor: 1 },
    ]);
    expect(total).toBe(99_999_99 + 10 + 7);
  });

  it("totals an empty invoice at zero rather than throwing", () => {
    expect(computeInvoiceTotalMinor([])).toBe(0);
  });
});

describe("formatInvoiceNumber", () => {
  it("pads the org-scoped sequence to a stable width", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-0001");
    expect(formatInvoiceNumber(42)).toBe("INV-0042");
  });

  it("keeps growing past the padding width rather than truncating", () => {
    expect(formatInvoiceNumber(12345)).toBe("INV-12345");
  });
});

describe("deriveInvoiceStatus", () => {
  const invoiced = (paidMinor: number) => computeOrderBalance({ invoicedMinor: 100_000_00, paidMinor });

  it("leaves Draft and Void alone regardless of what has been paid", () => {
    expect(deriveInvoiceStatus({ lifecycle: "draft", balance: invoiced(100_000_00) })).toBe("draft");
    expect(deriveInvoiceStatus({ lifecycle: "void", balance: invoiced(100_000_00) })).toBe("void");
  });

  it("stays Sent while nothing has been paid", () => {
    expect(deriveInvoiceStatus({ lifecycle: "sent", balance: invoiced(0) })).toBe("sent");
  });

  it("becomes Part Paid on a partial payment and Paid once settled", () => {
    expect(deriveInvoiceStatus({ lifecycle: "sent", balance: invoiced(40_000_00) })).toBe("part_paid");
    expect(deriveInvoiceStatus({ lifecycle: "sent", balance: invoiced(100_000_00) })).toBe("paid");
  });

  it("reads an overpaid Invoice as Paid, not Part Paid", () => {
    expect(deriveInvoiceStatus({ lifecycle: "sent", balance: invoiced(120_000_00) })).toBe("paid");
  });
});

describe("detectPaymentMismatches", () => {
  it("reports nothing when payments sit inside the invoiced total", () => {
    const balance = computeOrderBalance({ invoicedMinor: 50_000_00, paidMinor: 20_000_00 });
    expect(detectPaymentMismatches({ lifecycle: "sent", balance })).toEqual([]);
  });

  it("surfaces an overpayment with the excess rather than clamping the balance", () => {
    const balance = computeOrderBalance({ invoicedMinor: 50_000_00, paidMinor: 65_000_00 });
    expect(detectPaymentMismatches({ lifecycle: "sent", balance })).toContainEqual({
      kind: "overpaid",
      excessMinor: 15_000_00,
    });
  });

  it("flags payments recorded against a voided or draft Invoice", () => {
    const balance = computeOrderBalance({ invoicedMinor: 50_000_00, paidMinor: 10_000_00 });
    expect(detectPaymentMismatches({ lifecycle: "void", balance })).toContainEqual({ kind: "paid_against_void" });
    expect(detectPaymentMismatches({ lifecycle: "draft", balance })).toContainEqual({ kind: "paid_against_draft" });
  });
});

describe("line item validation", () => {
  it("requires a description and a quantity of at least one", () => {
    expect(() => assertValidLineItem({ description: "  ", quantity: 1, unitPriceMinor: 100 })).toThrow("description");
    expect(() => assertValidLineItem({ description: "Suit", quantity: 0, unitPriceMinor: 100 })).toThrow("at least 1");
    expect(() => assertValidLineItem({ description: "Suit", quantity: 1.5, unitPriceMinor: 100 })).toThrow("whole number");
  });

  it("allows a zero unit price but not a negative one", () => {
    expect(() => assertValidLineItem({ description: "Complimentary tie", quantity: 1, unitPriceMinor: 0 })).not.toThrow();
    expect(() => assertValidLineItem({ description: "Suit", quantity: 1, unitPriceMinor: -1 })).toThrow("negative");
  });
});

describe("invoice transitions", () => {
  it("freezes line items once an Invoice has been sent", () => {
    expect(() => assertLineItemsEditable("draft")).not.toThrow();
    expect(() => assertLineItemsEditable("sent")).toThrow("Void it to correct");
    expect(() => assertLineItemsEditable("void")).toThrow("voided Invoice cannot be edited");
  });

  it("refuses to send an empty Invoice, a sent one, or a voided one", () => {
    expect(() => assertSendable("draft", 0)).toThrow("at least one line item");
    expect(() => assertSendable("draft", 1)).not.toThrow();
    expect(() => assertSendable("sent", 1)).toThrow("already been sent");
    expect(() => assertSendable("void", 1)).toThrow("voided Invoice cannot be sent");
  });

  it("requires a non-empty reason to void, and refuses to void twice", () => {
    expect(() => assertVoidable("sent", "   ")).toThrow("reason is required");
    expect(() => assertVoidable("sent", "Wrong client")).not.toThrow();
    expect(() => assertVoidable("void", "Wrong client")).toThrow("already void");
  });
});
