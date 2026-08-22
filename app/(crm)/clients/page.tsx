import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/repository";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkGenerator } from "@/components/link-generator";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; includeArchived?: string; page?: string; orderState?: "all" | "without_orders" | "with_orders" }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { clients, hasNextPage } = await listClients(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    orderState: params.orderState,
    page,
  });

  return (
    <div>
      <header className="grid min-w-0 gap-8 border-b border-kuartz-line pb-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <p className="eyebrow">Clients</p>
          <h1 className="page-title">Directory</h1>
          <p className="page-description">Everyone in the system, whether they already have an Order or are still a contact.</p>
        </div>
        <div className="flex w-full max-w-full flex-col items-stretch gap-3 sm:w-72 xl:items-end">
          <Button asChild className="w-full">
            <Link href="/clients/new">Add Client</Link>
          </Button>
          <LinkGenerator />
        </div>
      </header>

      <form method="get" className="mt-8 grid min-w-0 gap-4 rounded-[1rem] border border-kuartz-line bg-white/55 p-4 lg:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_16rem_auto_auto] xl:items-end">
        <label className="form-group">
          <span>Search</span>
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Name, phone, or email"
            className="min-h-[3.1rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          />
        </label>
        <label className="form-group">
          <span>Filter</span>
          <select
            name="orderState"
            defaultValue={params.orderState ?? "all"}
            className="min-h-[3.1rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-3 text-sm text-kuartz-ink outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
          >
            <option value="all">All clients</option>
            <option value="without_orders">Without orders</option>
            <option value="with_orders">With orders</option>
          </select>
        </label>
        <label className="flex min-h-[3.1rem] items-center gap-2 rounded-[0.8rem] border border-kuartz-line bg-white/60 px-3.5 text-sm font-semibold text-kuartz-secondary xl:self-end">
          <input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} />
          Archived
        </label>
        <Button type="submit" variant="outline" className="min-h-[3.1rem] xl:self-end">
          Search
        </Button>
      </form>

      <section className="mt-9">
        {clients.length ? (
          <>
          <ul className="divide-y divide-kuartz-line border-y border-kuartz-line xl:hidden">
            {clients.map((client) => (
              <li key={client.id} className="py-4">
                <Link href={`/clients/${client.id}`} className="block min-h-11 font-semibold text-kuartz-ink">
                  {client.fullName}
                  <span className="mt-1 block text-sm font-normal text-kuartz-secondary">{client.primaryPhone}{client.email ? ` · ${client.email}` : ""}</span>
                </Link>
                <p className="mt-2 text-sm text-kuartz-body">{client.orderCount ? `Latest Order: ${client.latestOrderTitle}` : "No Orders yet"}</p>
                <p className="mt-1 text-xs text-kuartz-muted">{client.archivedAt ? "Archived" : "Active"} · Added {dateFormatter.format(client.createdAt)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-y border-kuartz-line xl:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-kuartz-secondary">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Orders</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="pl-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kuartz-line">
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="py-4 pr-4 font-semibold text-kuartz-ink">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-kuartz-secondary">
                      {client.primaryPhone}
                      {client.email ? ` · ${client.email}` : ""}
                    </td>
                    <td className="px-4 py-4 text-kuartz-ink">{client.orderCount ? client.latestOrderTitle : "No Orders yet"}</td>
                    <td className="px-4 py-4 text-kuartz-secondary">{client.archivedAt ? "Archived" : "Active"}</td>
                    <td className="pl-4 py-4 text-kuartz-secondary">{dateFormatter.format(client.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <EmptyState
            className="mt-4"
            title="No Clients yet"
            description="Add a Client from an intake or create one directly."
          />
        )}
        {clients.length && (page > 1 || hasNextPage) ? (
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

function pageHref(params: { search?: string; includeArchived?: string; orderState?: string }, page: number): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (params.orderState && params.orderState !== "all") query.set("orderState", params.orderState);
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/clients?${queryString}` : "/clients";
}
