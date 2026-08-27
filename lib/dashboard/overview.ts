import type { OrderBalance, VendorPaymentPosition } from "@/lib/finance/balances";

export function sortOpenTodosByDueDate<T extends { dueDate: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export type DashboardFinanceSummary = {
  outstandingClientMinor: number;
  outstandingClientOrderCount: number;
  owedToVendorsMinor: number;
  unpaidVendorAssignmentCount: number;
};

export function summarizeDashboardFinance(input: {
  orderBalances: readonly { balance: OrderBalance }[];
  vendorPositions: readonly { position: VendorPaymentPosition }[];
}): DashboardFinanceSummary {
  const outstandingClients = input.orderBalances.filter(
    (row) => row.balance.state === "invoiced" && row.balance.balanceMinor > 0,
  );
  const unpaidVendors = input.vendorPositions.filter(
    (row) => row.position.state === "agreed" && row.position.owedMinor > 0,
  );

  return {
    outstandingClientMinor: outstandingClients.reduce(
      (total, row) => total + (row.balance.state === "invoiced" ? row.balance.balanceMinor : 0),
      0,
    ),
    outstandingClientOrderCount: outstandingClients.length,
    owedToVendorsMinor: unpaidVendors.reduce(
      (total, row) => total + (row.position.state === "agreed" ? row.position.owedMinor : 0),
      0,
    ),
    unpaidVendorAssignmentCount: unpaidVendors.length,
  };
}
