import Link from "next/link";
import { Search } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/session";
import { listClients, type ClientSort, type SortDirection } from "@/lib/clients/repository";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkGenerator } from "@/components/link-generator";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});
const CLIENT_FILTERS: { value: "all" | "without_orders" | "with_orders"; label: string }[] = [
  { value: "all", label: "All Clients" },
  { value: "without_orders", label: "Without Orders" },
  { value: "with_orders", label: "With Orders" },
];

function parseClientSort(value: string | undefined): ClientSort {
  return ["client", "contact", "orders", "status", "created"].includes(value ?? "") ? (value as ClientSort) : "created";
}
function parseSortDirection(value: string | undefined): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    includeArchived?: string;
    page?: string;
    orderState?: "all" | "without_orders" | "with_orders";
    sort?: string;
    direction?: string;
  }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const sort = parseClientSort(params.sort);
  const direction = parseSortDirection(params.direction);
  const { clients, hasNextPage } = await listClients(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    orderState: params.orderState,
    page,
    sort,
    direction,
  });
  const orderState = params.orderState ?? "all";
  const emptyTitle = params.search
    ? "No matching clients"
    : orderState === "without_orders"
      ? "No clients without orders"
      : orderState === "with_orders"
        ? "No clients with orders yet"
        : "No clients yet";
  const emptyDescription = params.search
    ? "Try another name, phone number, or email address."
    : orderState === "without_orders"
      ? "Every current client has at least one order."
      : orderState === "with_orders"
        ? "Clients will appear here after an order is created for them."
        : "Add a client manually or send an intake link.";

  return (
    <div>
      <header className="grid min-w-0 gap-8 border-b border-kuartz-line pb-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <p className="eyebrow">Clients</p>
          <h1 className="page-title">Clients</h1>
          <p className="page-description">Manage all contacts and clients in one place.</p>
        </div>
        <div className="flex w-full max-w-full flex-col items-stretch gap-3 sm:w-72 xl:items-end">
          <Button asChild className="w-full">
            <Link href="/clients/new">Add Client</Link>
          </Button>
          <LinkGenerator />
        </div>
      </header>

      <section className="mt-7">
          <nav className="mb-4 flex flex-wrap gap-x-8 gap-y-1 border-b border-kuartz-line" aria-label="Client views">
            {CLIENT_FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={clientFilterHref(params, filter.value)}
                aria-current={(params.orderState ?? "all") === filter.value ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-2 text-sm transition-colors ${
                  (params.orderState ?? "all") === filter.value
                    ? "border-kuartz-lime font-extrabold text-kuartz-ink"
                    : "border-transparent font-medium text-kuartz-secondary hover:text-kuartz-ink"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
          <form method="get" className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {params.orderState && params.orderState !== "all" ? <input type="hidden" name="orderState" value={params.orderState} /> : null}
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="direction" value={direction} />
            <label className="relative block w-full lg:max-w-md">
              <span className="sr-only">Search</span>
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-kuartz-muted" />
              <input
                type="search"
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Search name, phone, or email"
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
          {clients.length ? (
          <>
          <ul className="divide-y divide-kuartz-line border-y border-kuartz-line xl:hidden">
            {clients.map((client) => (
              <li key={client.id} className="py-4">
                <Link href={`/clients/${client.id}`} className="block min-h-11 font-semibold text-kuartz-ink">
                  {client.fullName}
                  <span className="mt-1 block text-sm font-normal text-kuartz-secondary">{client.primaryPhone}{client.email ? ` | ${client.email}` : ""}</span>
                </Link>
                <p className="mt-2 text-sm text-kuartz-body">{client.orderCount ? `Latest Order: ${client.latestOrderTitle}` : "No Orders yet"}</p>
                <p className="mt-1 text-xs text-kuartz-muted">{client.archivedAt ? "Archived" : "Active"} | Added {dateFormatter.format(client.createdAt)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[0.8rem] border border-kuartz-line xl:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f4f3f0] text-xs text-kuartz-secondary">
                <tr>
                  <th className="py-3 pl-4 pr-4" aria-sort={sort === "client" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "client")} active={sort === "client"} direction={direction}>Client</SortableTableHeader>
                  </th>
                  <th className="px-4 py-3" aria-sort={sort === "contact" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "contact")} active={sort === "contact"} direction={direction}>Contact</SortableTableHeader>
                  </th>
                  <th className="px-4 py-3" aria-sort={sort === "orders" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "orders")} active={sort === "orders"} direction={direction}>Orders</SortableTableHeader>
                  </th>
                  <th className="px-4 py-3" aria-sort={sort === "status" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "status")} active={sort === "status"} direction={direction}>Status</SortableTableHeader>
                  </th>
                  <th className="pl-4 py-3" aria-sort={sort === "created" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableTableHeader href={sortHref(params, "created")} active={sort === "created"} direction={direction}>Created</SortableTableHeader>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kuartz-line bg-white/75">
                {clients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-[#fbfaf7]">
                    <td className="py-3.5 pl-4 pr-4 font-semibold text-kuartz-ink">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-kuartz-secondary">
                      {client.primaryPhone}
                      {client.email ? ` | ${client.email}` : ""}
                    </td>
                    <td className="px-4 py-3.5 text-kuartz-ink">{client.orderCount ? client.latestOrderTitle : "No Orders yet"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${client.archivedAt ? "bg-[#fff4ec] text-[#9a4b21]" : "bg-[#edfbdc] text-[#286b2a]"}`}>
                        {client.archivedAt ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="pl-4 py-3.5 text-kuartz-secondary">{dateFormatter.format(client.createdAt)}</td>
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
        {clients.length && (page > 1 || hasNextPage) ? (
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
  params: { search?: string; includeArchived?: string; orderState?: string; sort?: string; direction?: string },
  page: number,
): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (params.orderState && params.orderState !== "all") query.set("orderState", params.orderState);
  query.set("sort", parseClientSort(params.sort));
  query.set("direction", parseSortDirection(params.direction));
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/clients?${queryString}` : "/clients";
}

function clientFilterHref(
  params: { search?: string; includeArchived?: string; sort?: string; direction?: string },
  orderState: "all" | "without_orders" | "with_orders",
): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (orderState !== "all") query.set("orderState", orderState);
  query.set("sort", parseClientSort(params.sort));
  query.set("direction", parseSortDirection(params.direction));
  const queryString = query.toString();
  return queryString ? `/clients?${queryString}` : "/clients";
}

function sortHref(
  params: { search?: string; includeArchived?: string; orderState?: string; sort?: string; direction?: string },
  sort: ClientSort,
): string {
  const query = new URLSearchParams();
  const currentSort = parseClientSort(params.sort);
  const currentDirection = parseSortDirection(params.direction);
  const nextDirection: SortDirection = currentSort === sort && currentDirection === "asc" ? "desc" : "asc";
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (params.orderState && params.orderState !== "all") query.set("orderState", params.orderState);
  query.set("sort", sort);
  query.set("direction", nextDirection);
  return `/clients?${query.toString()}`;
}

