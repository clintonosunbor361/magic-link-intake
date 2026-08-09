import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/empty-state";
import { canManageFinance } from "@/lib/domain/access-control";
import { listOrderBalances, listVendorPaymentPositions } from "@/lib/finance/repository";
import { formatMinorUnits } from "@/lib/forms/money";

// The money overview. Every figure here is computed from live rows by the Milestone 6 balance
// functions — nothing is stored or cached, so this page cannot disagree with the Invoice or the
// production workspace it links to.

export default async function FinancePage() {
  const session = await requireStaffSession();
  if (!canManageFinance(session.role)) redirect("/");

  const [balances, vendorPositions] = await Promise.all([
    listOrderBalances(session.organizationId),
    listVendorPaymentPositions(session.organizationId),
  ]);

  const outstanding = balances.filter(
    (row) => row.balance.state === "invoiced" && row.balance.balanceMinor > 0,
  );
  const notInvoiced = balances.filter((row) => row.balance.state === "not_invoiced" && !row.completedAt);
  const owedToVendors = vendorPositions.filter(
    (row) => row.position.state === "agreed" && row.position.owedMinor > 0,
  );

  const totalOutstandingMinor = outstanding.reduce(
    (total, row) => total + (row.balance.state === "invoiced" ? row.balance.balanceMinor : 0),
    0,
  );
  const totalOwedMinor = owedToVendors.reduce(
    (total, row) => total + (row.position.state === "agreed" ? row.position.owedMinor : 0),
    0,
  );

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Finance</p>
        <h1 className="page-title">Money position</h1>
        <p className="page-description">
          What clients still owe Kuartz, and what Kuartz still owes Vendors. Both are calculated from
          live records every time this page loads.
        </p>
      </header>

      <section className="mt-9 grid gap-4 sm:grid-cols-2">
        <div className="border-y border-kuartz-line py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">
            Outstanding from clients
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-kuartz-ink">
            ₦{formatMinorUnits(totalOutstandingMinor)}
          </p>
          <p className="mt-1 text-sm text-kuartz-secondary">
            {outstanding.length} Order{outstanding.length === 1 ? "" : "s"} with a balance
          </p>
        </div>
        <div className="border-y border-kuartz-line py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Owed to vendors</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-kuartz-ink">
            ₦{formatMinorUnits(totalOwedMinor)}
          </p>
          <p className="mt-1 text-sm text-kuartz-secondary">
            {owedToVendors.length} assignment{owedToVendors.length === 1 ? "" : "s"} unpaid
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="section-title">Outstanding client balances</h2>
        {outstanding.length ? (
          <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {outstanding.map((row) => (
              <div
                key={row.orderId}
                className="grid gap-2 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-kuartz-ink">
                    <Link href={`/orders/${row.orderId}/invoice`} className="underline-offset-4 hover:underline">
                      {row.orderTitle}
                    </Link>
                  </p>
                  <p className="mt-1 text-kuartz-secondary">
                    {row.clientName}
                    {row.invoiceNumber ? ` · ${row.invoiceNumber}` : ""}
                    {row.completedAt ? " · Order completed" : ""}
                  </p>
                </div>
                <p className="font-semibold text-kuartz-ink sm:text-right">
                  ₦{formatMinorUnits(row.balance.state === "invoiced" ? row.balance.balanceMinor : 0)}
                  <span className="ml-2 font-medium text-kuartz-muted">
                    of ₦{formatMinorUnits(row.balance.state === "invoiced" ? row.balance.invoicedMinor : 0)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            title="Nothing outstanding"
            description="Every invoiced Order has been settled."
          />
        )}
      </section>

      {notInvoiced.length ? (
        <section className="mt-10">
          <h2 className="section-title">Not invoiced yet</h2>
          <p className="mt-2 text-sm text-kuartz-secondary">
            Live Orders with no Invoice. Nothing has been billed, so no balance exists to chase.
          </p>
          <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {notInvoiced.map((row) => (
              <div key={row.orderId} className="grid gap-2 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p className="font-semibold text-kuartz-ink">
                    <Link href={`/orders/${row.orderId}/invoice`} className="underline-offset-4 hover:underline">
                      {row.orderTitle}
                    </Link>
                  </p>
                  <p className="mt-1 text-kuartz-secondary">{row.clientName}</p>
                </div>
                <p className="text-kuartz-muted sm:text-right">Create Invoice</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="section-title">Vendor payments owed</h2>
        {owedToVendors.length ? (
          <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {owedToVendors.map((row) => (
              <div
                key={row.assignmentId}
                className="grid gap-2 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-kuartz-ink">
                    <Link href={`/production/${row.assignmentId}`} className="underline-offset-4 hover:underline">
                      {row.label}
                    </Link>
                  </p>
                  <p className="mt-1 text-kuartz-secondary">
                    {row.vendorName} · {row.orderTitle} · due {row.deadline}
                  </p>
                </div>
                <p className="font-semibold text-kuartz-ink sm:text-right">
                  ₦{formatMinorUnits(row.position.state === "agreed" ? row.position.owedMinor : 0)}
                  <span className="ml-2 font-medium text-kuartz-muted">
                    of ₦{formatMinorUnits(row.position.state === "agreed" ? row.position.agreedCostMinor : 0)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            title="No vendor balances"
            description="Every assignment with an agreed cost has been paid in full."
          />
        )}
      </section>
    </div>
  );
}
