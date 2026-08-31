import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { listOrders, type OrderStatusFilter } from "@/lib/orders/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const ORDER_STATUS_OPTIONS: { value: OrderStatusFilter; label: string; heading: string }[] = [
  { value: "all", label: "All orders", heading: "All Orders" },
  { value: "active", label: "Active orders", heading: "Active Orders" },
  { value: "completed", label: "Completed orders", heading: "Completed Orders" },
  { value: "delayed", label: "Delayed orders", heading: "Delayed Orders" },
];

function parseOrderStatus(value: string | undefined): OrderStatusFilter {
  return ORDER_STATUS_OPTIONS.some((option) => option.value === value) ? (value as OrderStatusFilter) : "all";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; includeArchived?: string; page?: string; status?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const status = parseOrderStatus(params.status);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const timezone = await getOrganizationTimezone(session.organizationId);
  const { orders, hasNextPage } = await listOrders(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    page,
    status,
    today: businessToday(timezone),
  });
  const currentStatus = ORDER_STATUS_OPTIONS.find((option) => option.value === status) ?? ORDER_STATUS_OPTIONS[0];

  return (
    <div>
      <header className="flex flex-col gap-5 border-b border-kuartz-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Orders</p>
          <h1 className="page-title">{currentStatus.heading}</h1>
          <p className="page-description">
            {status === "delayed"
              ? "Active orders with vendor work behind schedule."
              : "Manage confirmed client orders."}
          </p>
        </div>
        <Button asChild className="h-11 min-h-11 w-full self-start gap-2 py-0 sm:w-auto">
          <Link href="/orders/new"><Plus size={17} aria-hidden="true" /> Add Order</Link>
        </Button>
      </header>

      <form method="get" className="mt-8 grid gap-4 rounded-[1rem] border border-kuartz-line bg-white/65 p-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto_auto] sm:items-end">
        <label className="form-group">
          <span>Search</span>
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Order title or client name"
            className="min-h-[3.1rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>
        <label className="form-group">
          <span>Status</span>
          <NativeSelect name="status" defaultValue={status}>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-h-[3.1rem] items-center gap-2 text-sm font-semibold text-kuartz-secondary">
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
          <ul className="divide-y divide-kuartz-line border-y border-kuartz-line xl:hidden">
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
          <div className="hidden overflow-x-auto border-y border-kuartz-line xl:block">
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
            description="Add an order after price and scope are agreed."
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

function pageHref(params: { search?: string; includeArchived?: string; status?: string }, page: number): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (parseOrderStatus(params.status) !== "all") query.set("status", parseOrderStatus(params.status));
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/orders?${queryString}` : "/orders";
}
