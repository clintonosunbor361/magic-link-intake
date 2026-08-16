import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/session";
import { listOrders } from "@/lib/orders/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; includeArchived?: string; page?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { orders, hasNextPage } = await listOrders(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    page,
  });

  return (
    <div>
      <header className="flex flex-col gap-5 border-b border-kuartz-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Orders</p>
          <h1 className="page-title">All Orders</h1>
          <p className="page-description">Every agreed Order across every Client.</p>
        </div>
        <Button asChild className="h-11 min-h-11 w-full self-start gap-2 py-0 sm:w-auto">
          <Link href="/orders/new"><Plus size={17} aria-hidden="true" /> Add Order</Link>
        </Button>
      </header>

      <form method="get" className="mt-8 flex flex-wrap items-center gap-4">
        <input
          type="search"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Search by Order title or Client name"
          className="min-h-[3.1rem] w-full max-w-sm rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-kuartz-secondary">
          <input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} />
          Include archived
        </label>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <section className="mt-9">
        {orders.length ? (
          <>
          <ul className="divide-y divide-kuartz-line border-y border-kuartz-line md:hidden">
            {orders.map((order) => (
              <li key={order.id} className="py-4">
                <Link href={`/orders/${order.id}`} className="block min-h-11 font-semibold text-kuartz-ink">
                  {order.title}{order.archivedAt ? <span className="ml-2 text-xs font-normal text-kuartz-muted">Archived</span> : null}
                </Link>
                <Link href={`/clients/${order.clientId}`} className="text-sm text-kuartz-secondary hover:underline">{order.clientFullName}</Link>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-xs text-kuartz-muted">Price</dt><dd className="tabular-nums text-kuartz-body">₦{formatMinorUnits(order.finalAgreedPriceMinor)}</dd></div>
                  <div><dt className="text-xs text-kuartz-muted">Looks</dt><dd className="text-kuartz-body">{order.lookCount}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-y border-kuartz-line md:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-xs text-kuartz-secondary">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Looks</th>
                  <th className="pl-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kuartz-line">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-4 pr-4 font-semibold text-kuartz-ink">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.title}
                      </Link>
                      {order.archivedAt ? <span className="ml-2 text-xs font-normal text-kuartz-muted">Archived</span> : null}
                    </td>
                    <td className="px-4 py-4 text-kuartz-secondary">
                      <Link href={`/clients/${order.clientId}`} className="hover:underline">
                        {order.clientFullName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-kuartz-ink">{order.eventType}</td>
                    <td className="px-4 py-4 text-kuartz-ink">₦{formatMinorUnits(order.finalAgreedPriceMinor)}</td>
                    <td className="px-4 py-4 text-kuartz-secondary">{order.lookCount}</td>
                    <td className="pl-4 py-4 text-kuartz-secondary">{dateFormatter.format(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <EmptyState
            className="mt-4"
            title="No Orders yet"
            description="Add confirmed work for an existing Client, or convert an Enquiry into a Client and Order."
          />
        )}
        {orders.length && (page > 1 || hasNextPage) ? (
          <div className="mt-6 flex items-center justify-between">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={pageHref(params, page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Previous
              </Button>
            )}
            <span className="text-sm text-kuartz-secondary">Page {page}</span>
            {hasNextPage ? (
              <Button asChild variant="outline">
                <Link href={pageHref(params, page + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Next
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function pageHref(params: { search?: string; includeArchived?: string }, page: number): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/orders?${queryString}` : "/orders";
}
