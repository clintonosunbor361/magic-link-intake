import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffSession } from "@/lib/auth/session";
import { listPendingRatingPrompts } from "@/lib/vendors/rating-repository";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

/**
 * Every outstanding rating prompt across all completed Orders. Nothing is stored to build this —
 * the list is derived, so it is always exactly the set of (Order, Vendor) pairs still missing a
 * rating, and a prompt disappears the moment its rating is saved.
 */
export default async function PendingVendorRatingsPage() {
  const session = await requireStaffSession();
  const prompts = await listPendingRatingPrompts(session.organizationId);

  // Grouped by Order so the page reads as "these jobs still need rating" rather than a flat list of
  // vendor names repeated across Orders.
  const byOrder = new Map<
    string,
    { orderId: string; orderTitle: string; clientName: string; completedAt: Date | null; vendors: { id: string; name: string }[] }
  >();
  for (const prompt of prompts) {
    const existing = byOrder.get(prompt.orderId);
    if (existing) {
      existing.vendors.push({ id: prompt.vendorId, name: prompt.vendorName });
      continue;
    }
    byOrder.set(prompt.orderId, {
      orderId: prompt.orderId,
      orderTitle: prompt.orderTitle,
      clientName: prompt.clientName,
      completedAt: prompt.completedAt,
      vendors: [{ id: prompt.vendorId, name: prompt.vendorName }],
    });
  }
  const groups = [...byOrder.values()].sort(
    (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
  );

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Vendor ratings</p>
        <h1 className="page-title">Pending ratings</h1>
        <p className="page-description">
          Vendors who worked on a completed Order and have not been rated on it yet. Each one clears
          as soon as you rate it.
        </p>
      </header>

      {groups.length ? (
        <section className="mt-9 divide-y divide-kuartz-line border-y border-kuartz-line">
          {groups.map((group) => (
            <div key={group.orderId} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="font-semibold text-kuartz-ink">
                  <Link href={`/orders/${group.orderId}`} className="underline-offset-4 hover:underline">
                    {group.orderTitle}
                  </Link>
                </p>
                <p className="mt-1 text-sm text-kuartz-secondary">
                  {group.clientName}
                  {group.completedAt ? ` · completed ${dateFormatter.format(group.completedAt)}` : ""}
                </p>
                <p className="mt-2 text-sm text-kuartz-muted">
                  Awaiting: {group.vendors.map((vendor) => vendor.name).join(", ")}
                </p>
              </div>
              <Link
                href={`/orders/${group.orderId}/vendor-ratings`}
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.8rem] border border-kuartz-ink px-4 text-sm font-semibold text-kuartz-ink transition-colors duration-200 hover:bg-kuartz-ink hover:text-white"
              >
                Rate {group.vendors.length} Vendor{group.vendors.length === 1 ? "" : "s"}
              </Link>
            </div>
          ))}
        </section>
      ) : (
        <EmptyState
          className="mt-9"
          title="Nothing pending"
          description="Every Vendor on every completed Order has been rated."
        />
      )}
    </div>
  );
}
