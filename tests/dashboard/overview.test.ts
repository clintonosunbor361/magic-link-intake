import { describe, expect, it } from "vitest";
import { sortOpenTodosByDueDate, summarizeDashboardFinance } from "@/lib/dashboard/overview";

describe("sortOpenTodosByDueDate", () => {
  it("keeps future open to-dos and sorts every row by the closest due date", () => {
    const rows = [
      { id: "later", dueDate: "2026-09-12" },
      { id: "overdue", dueDate: "2026-08-20" },
      { id: "future", dueDate: "2026-09-01" },
    ];

    expect(sortOpenTodosByDueDate(rows).map((row) => row.id)).toEqual(["overdue", "future", "later"]);
  });

  it("does not mutate repository results while sorting them", () => {
    const rows = [
      { id: "later", dueDate: "2026-09-12" },
      { id: "first", dueDate: "2026-08-20" },
    ];

    sortOpenTodosByDueDate(rows);

    expect(rows.map((row) => row.id)).toEqual(["later", "first"]);
  });
});

describe("summarizeDashboardFinance", () => {
  it("totals only positive client and Vendor balances in integer minor units", () => {
    const summary = summarizeDashboardFinance({
      orderBalances: [
        { balance: { state: "invoiced", invoicedMinor: 500_000, paidMinor: 125_000, balanceMinor: 375_000 } },
        { balance: { state: "invoiced", invoicedMinor: 200_000, paidMinor: 200_000, balanceMinor: 0 } },
        { balance: { state: "invoiced", invoicedMinor: 100_000, paidMinor: 120_000, balanceMinor: -20_000 } },
        { balance: { state: "not_invoiced" } },
      ],
      vendorPositions: [
        { position: { state: "agreed", agreedCostMinor: 250_000, paidMinor: 50_000, owedMinor: 200_000 } },
        { position: { state: "agreed", agreedCostMinor: 40_000, paidMinor: 40_000, owedMinor: 0 } },
        { position: { state: "no_agreed_cost" } },
      ],
    });

    expect(summary).toEqual({
      outstandingClientMinor: 375_000,
      outstandingClientOrderCount: 1,
      owedToVendorsMinor: 200_000,
      unpaidVendorAssignmentCount: 1,
    });
  });
});
