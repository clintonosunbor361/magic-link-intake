import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/repository";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; includeArchived?: string; page?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { clients, hasNextPage } = await listClients(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    page,
  });

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Clients</p>
        <h1 className="page-title">Directory</h1>
        <p className="page-description">Everyone who has agreed at least one Order with Kuartz.</p>
      </header>

      <form method="get" className="mt-8 flex flex-wrap items-center gap-4">
        <input
          type="search"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Search by name, phone, or email"
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
        {clients.length ? (
          <>
          <ul className="divide-y divide-kuartz-line border-y border-kuartz-line md:hidden">
            {clients.map((client) => (
              <li key={client.id} className="py-4">
                <Link href={`/clients/${client.id}`} className="block min-h-11 font-semibold text-kuartz-ink">
                  {client.fullName}
                  <span className="mt-1 block text-sm font-normal text-kuartz-secondary">{client.primaryPhone}{client.email ? ` · ${client.email}` : ""}</span>
                </Link>
                <p className="mt-2 text-sm text-kuartz-body">Latest Order: {client.latestOrderTitle || "None yet"}</p>
                <p className="mt-1 text-xs text-kuartz-muted">{client.archivedAt ? "Archived" : "Active"} · Added {dateFormatter.format(client.createdAt)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-y border-kuartz-line md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-kuartz-secondary">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Latest Order</th>
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
                    <td className="px-4 py-4 text-kuartz-ink">{client.latestOrderTitle || "—"}</td>
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
            description="Convert an Enquiry into a Client and Order to see it here."
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

function pageHref(params: { search?: string; includeArchived?: string }, page: number): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/clients?${queryString}` : "/clients";
}
