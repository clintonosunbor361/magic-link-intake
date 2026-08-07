import { describe, expect, it } from "vitest";
import { blocksOrderCompletion, computeOrderBalance, computeVendorPaymentPosition } from "@/lib/finance/balances";

describe("computeOrderBalance", () => {
  it("distinguishes an uninvoiced Order from one invoiced at zero", () => {
    expect(computeOrderBalance({ invoicedMinor: null, paidMinor: 0 })).toEqual({ state: "not_invoiced" });
    expect(computeOrderBalance({ invoicedMinor: 0, paidMinor: 0 })).toEqual({
      state: "invoiced",
      invoicedMinor: 0,
      paidMinor: 0,
      balanceMinor: 0,
    });
  });

  it("subtracts payments from the invoiced total in minor units", () => {
    expect(computeOrderBalance({ invoicedMinor: 15_000_00, paidMinor: 8_000_00 })).toMatchObject({
      balanceMinor: 7_000_00,
    });
  });

  it("reports an overpayment as a negative balance rather than clamping", () => {
    expect(computeOrderBalance({ invoicedMinor: 5_000_00, paidMinor: 6_000_00 })).toMatchObject({
      balanceMinor: -1_000_00,
    });
  });

  it("stays exact on values that would drift in floating point", () => {
    // 0.1 + 0.2 arithmetic in naira would not land on a clean figure; minor units always do.
    expect(computeOrderBalance({ invoicedMinor: 10, paidMinor: 20 }).state === "invoiced").toBe(true);
    expect(computeOrderBalance({ invoicedMinor: 100_000_03, paidMinor: 33_333_34 })).toMatchObject({
      balanceMinor: 66_666_69,
    });
  });
});

describe("computeVendorPaymentPosition", () => {
  it("reports no agreed cost separately from a cost of zero", () => {
    expect(computeVendorPaymentPosition({ agreedCostMinor: null, paidMinor: 0 })).toEqual({
      state: "no_agreed_cost",
    });
    expect(computeVendorPaymentPosition({ agreedCostMinor: 0, paidMinor: 0 })).toMatchObject({
      state: "agreed",
      owedMinor: 0,
    });
  });

  it("computes owed as agreed cost minus payments", () => {
    // Milestone 5 always supplies paidMinor: 0 — vendor payment records arrive in Milestone 6 and
    // change only where this number comes from.
    expect(computeVendorPaymentPosition({ agreedCostMinor: 150_000_00, paidMinor: 0 })).toMatchObject({
      owedMinor: 150_000_00,
    });
    expect(computeVendorPaymentPosition({ agreedCostMinor: 150_000_00, paidMinor: 80_000_00 })).toMatchObject({
      agreedCostMinor: 150_000_00,
      paidMinor: 80_000_00,
      owedMinor: 70_000_00,
    });
  });
});

describe("blocksOrderCompletion", () => {
  it("blocks while a positive balance remains", () => {
    expect(blocksOrderCompletion(computeOrderBalance({ invoicedMinor: 10_000_00, paidMinor: 4_000_00 }))).toBe(true);
  });

  it("allows completion once the balance is settled or overpaid", () => {
    expect(blocksOrderCompletion(computeOrderBalance({ invoicedMinor: 10_000_00, paidMinor: 10_000_00 }))).toBe(false);
    expect(blocksOrderCompletion(computeOrderBalance({ invoicedMinor: 10_000_00, paidMinor: 11_000_00 }))).toBe(false);
  });

  it("blocks an Order that has never been invoiced", () => {
    expect(blocksOrderCompletion(computeOrderBalance({ invoicedMinor: null, paidMinor: 0 }))).toBe(true);
  });
});
