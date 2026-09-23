import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import {
  listOrders,
  type OrderSort,
  type OrderStatusFilter,
  type SortDirection,
} from "@/lib/orders/repository";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});
const ORDER_STATUS_OPTIONS: { value: OrderStatusFilter; label: string; heading: string }[] = [
  { value: "all", label: "All orders", heading: "All Orders" },
  { value: "active", label: "Active orders", heading: "Active Orders" },
  { value: "completed", label: "Completed orders", heading: "Completed Orders" },
  { value: "delayed", label: "Delayed orders", heading: "Delayed Orders" },
];

function parseOrderStatus(value: string | undefined): OrderStatusFilter {
  return ORDER_STATUS_OPTIONS.some((option) => option.value === value) ? (value as OrderStatusFilter) : "all";
}

function parseOrderSort(value: string | undefined): OrderSort {
  return ["order", "client", "event", "looks", "created"].includes(value ?? "") ? (value as OrderSort) : "created";
}

function parseSortDirection(value: string | undefined): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    includeArchived?: string;
    page?: string;
    status?: string;
    sort?: string;
    direction?: string;
  }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const status = parseOrderStatus(params.status);
  const sort = parseOrderSort(params.sort);
  const direction = parseSortDirection(params.direction);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const timezone = await getOrganizationTimezone(session.organizationId);
  const { orders, hasNextPage } = await listOrders(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    page,
    status,
    today: businessToday(timezone),
    sort,
    direction,
  });
  const currentStatus = ORDER_STATUS_OPTIONS.find((option) => option.value === status) ?? ORDER_STATUS_OPTIONS[0];
  const emptyTitle = params.search
    ? "No matching orders"
    : status === "completed"
      ? "No completed orders yet"
      : status === "delayed"
        ? "No delayed orders"
        : status === "active"
          ? "No active orders yet"
          : "No orders yet";
  const emptyDescription = params.search
    ? "Try another order title or client name."
    : status === "completed"
      ? "Orders will appear here after they are completed."
      : status === "delayed"
        ? "Active orders that fall behind schedule will appear here."
        : status === "active"
          ? "New and ongoing orders will appear here."
          : "Add an order after price and scope are agreed.";

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
        <Button asChild size="lg" className="w-full self-start sm:w-auto">
          <Link href="/orders/new"><Plus size={17} aria-hidden="true" /> Add Order</Link>
        </Button>
      </header>

      <section className="mt-7">
          <nav className="mb-4 flex flex-wrap gap-x-8 gap-y-1 border-b border-kuartz-line" aria-label="Order views">
            {ORDER_STATUS_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={statusHref(params, option.value)}
                aria-current={status === option.value ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-2 text-sm transition-colors ${
                  status === option.value
                    ? "border-kuartz-lime font-extrabold text-kuartz-ink"
                    : "border-transparent font-medium text-kuartz-secondary hover:text-kuartz-ink"
                }`}
              >
                {option.heading}
              </Link>
            ))}
          </nav>
          <form method="get" className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="direction" value={direction} />
            <label className="relative block w-full lg:max-w-md">
              <span className="sr-only">Search</span>
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-kuartz-muted" />
              <input
                type="search"
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Search order title or client"
                className="min-h-[2.75rem] w-full rounded-[0.65rem] border border-kuartz-control bg-white px-10 py-2.5 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:ring-4 focus:ring-kuartz-lime/20"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-[0.65rem] border border-kuartz-line bg-white px-3.5 text-sm font-semibold text-kuartz-secondary">
                <input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} />
                Archived
              </label>
              <Button type="submit" variant="outline" className="min-h-[2.75rem] gap-2 rounded-[0.65rem]">
                <Search size={16} aria-hidden="true" />
                Search
              </Button>
            </div>
          </form>
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
                  <div><dt className="text-xs text-kuartz-muted">Looks</dt><dd className="text-kuartz-body">{order.lookCount}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[0.8rem] border border-kuartz-line xl:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-[#f4f3f0] text-xs text-kuartz-secondary">
                <tr>
                  <th className="py-3 pl-4 pr-4" aria-sort={sort === "order" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "order")} active={sort === "order"} direction={direction}>Order</SortableTableHeader>
                  </th>
                  <th className="px-4 py-3" aria-sort={sort === "client" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "client")} active={sort === "client"} direction={direction}>Client</SortableTableHeader>
                  </th>
                  <th className="px-4 py-3" aria-sort={sort === "event" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "event")} active={sort === "event"} direction={direction}>Event</SortableTableHeader>
                  </th>
                  <th className="px-4 py-3" aria-sort={sort === "looks" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "looks")} active={sort === "looks"} direction={direction}>Looks</SortableTableHeader>
                  </th>
                  <th className="pl-4 py-3" aria-sort={sort === "created" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "created")} active={sort === "created"} direction={direction}>Created</SortableTableHeader>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kuartz-line bg-white/75">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-[#fbfaf7]">
                    <td className="py-3.5 pl-4 pr-4 font-semibold text-kuartz-ink">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.title}
                      </Link>
                      {order.archivedAt ? <span className="ml-2 text-xs font-normal text-kuartz-muted">Archived</span> : null}
                    </td>
                    <td className="px-4 py-3.5 text-kuartz-secondary">
                      <Link href={`/clients/${order.clientId}`} className="hover:underline">
                        {order.clientFullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-kuartz-ink">{order.eventType}</td>
                    <td className="px-4 py-3.5 text-kuartz-secondary">{order.lookCount}</td>
                    <td className="pl-4 py-3.5 text-kuartz-secondary">{dateFormatter.format(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <EmptyState
            className="rounded-[0.8rem] border border-kuartz-line bg-white/55 py-12"
            title={emptyTitle}
            description={emptyDescription}
          />
        )}
        {orders.length && (page > 1 || hasNextPage) ? (
          <div className="mt-4 flex items-center justify-between border-y border-kuartz-line px-1 py-3">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={pageHref(params, page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Previous
              </Button>
            )}
            <span className="text-sm text-kuartz-secondary">Showing page {page}</span>
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

function pageHref(
  params: { search?: string; includeArchived?: string; status?: string; sort?: string; direction?: string },
  page: number,
): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (parseOrderStatus(params.status) !== "all") query.set("status", parseOrderStatus(params.status));
  query.set("sort", parseOrderSort(params.sort));
  query.set("direction", parseSortDirection(params.direction));
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/orders?${queryString}` : "/orders";
}

function statusHref(
  params: { search?: string; includeArchived?: string; sort?: string; direction?: string },
  status: OrderStatusFilter,
): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (status !== "all") query.set("status", status);
  query.set("sort", parseOrderSort(params.sort));
  query.set("direction", parseSortDirection(params.direction));
  const queryString = query.toString();
  return queryString ? `/orders?${queryString}` : "/orders";
}

function sortHref(
  params: { search?: string; includeArchived?: string; status?: string; sort?: string; direction?: string },
  sort: OrderSort,
): string {
  const query = new URLSearchParams();
  const currentSort = parseOrderSort(params.sort);
  const currentDirection = parseSortDirection(params.direction);
  const nextDirection: SortDirection = currentSort === sort && currentDirection === "asc" ? "desc" : "asc";
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (parseOrderStatus(params.status) !== "all") query.set("status", parseOrderStatus(params.status));
  query.set("sort", sort);
  query.set("direction", nextDirection);
  return `/orders?${query.toString()}`;
}
