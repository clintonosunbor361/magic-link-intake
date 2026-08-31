import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/repository";
import { listMagicLinks, type LinkStatus, type MagicLinkSummary } from "@/lib/magic-links";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkGenerator } from "@/components/link-generator";
import { NativeSelect } from "@/components/ui/native-select";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const linkDateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; includeArchived?: string; page?: string; orderState?: "all" | "without_orders" | "with_orders" }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const [{ clients, hasNextPage }, intakeLinks] = await Promise.all([
    listClients(session.organizationId, {
      search: params.search,
      includeArchived: params.includeArchived === "1",
      orderState: params.orderState,
      page,
    }),
    listMagicLinks(session.organizationId),
  ]);

  return (
    <div>
      <header className="grid min-w-0 gap-8 border-b border-kuartz-line pb-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <p className="eyebrow">Clients</p>
          <h1 className="page-title">Directory</h1>
          <p className="page-description">Manage all contacts and clients in one place.</p>
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
          <NativeSelect
            name="orderState"
            defaultValue={params.orderState ?? "all"}
            className="min-h-[3.1rem] rounded-[0.8rem]"
          >
            <option value="all">All clients</option>
            <option value="without_orders">Without orders</option>
            <option value="with_orders">With orders</option>
          </NativeSelect>
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
                  <span className="mt-1 block text-sm font-normal text-kuartz-secondary">{client.primaryPhone}{client.email ? ` | ${client.email}` : ""}</span>
                </Link>
                <p className="mt-2 text-sm text-kuartz-body">{client.orderCount ? `Latest Order: ${client.latestOrderTitle}` : "No Orders yet"}</p>
                <p className="mt-1 text-xs text-kuartz-muted">{client.archivedAt ? "Archived" : "Active"} | Added {dateFormatter.format(client.createdAt)}</p>
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
                      {client.email ? ` | ${client.email}` : ""}
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
            description="Add a client manually or send an intake link."
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

      <GeneratedIntakeLinks links={intakeLinks.slice(0, 8)} />
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

function GeneratedIntakeLinks({ links }: { links: MagicLinkSummary[] }) {
  return (
    <section className="mt-10 border-t border-kuartz-line pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Intake</p>
          <h2 className="section-title mt-2">Generated intake links</h2>
        </div>
        <span className="rounded-full border border-kuartz-line bg-white/70 px-3 py-1 text-xs font-extrabold text-kuartz-secondary">
          {links.length} recent
        </span>
      </div>

      <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
        {links.length ? (
          links.map((link) => (
            <div key={link.id} className="grid gap-3 py-4 text-sm lg:grid-cols-[minmax(0,1fr)_8rem_13rem] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-kuartz-ink">Generated {linkDateFormatter.format(new Date(link.createdAt))}</p>
                  <StatusPill status={link.status} />
                </div>
                <p className="mt-1 text-kuartz-secondary">
                  {link.generatedByName ? `Created by ${link.generatedByName}` : "Creator unavailable"} - Expires{" "}
                  {linkDateFormatter.format(new Date(link.expiresAt))}
                </p>
                <p className="mt-1 text-xs text-kuartz-muted">Token {link.hashPreview}</p>
              </div>
              <div>
                {link.clientId && link.clientName ? (
                  <Link href={`/clients/${link.clientId}`} className="font-semibold text-kuartz-ink underline-offset-4 hover:underline">
                    {link.clientName}
                  </Link>
                ) : (
                  <span className="text-kuartz-muted">No submission</span>
                )}
              </div>
              <p className="text-kuartz-secondary lg:text-right">
                {link.usedAt ? `Used ${linkDateFormatter.format(new Date(link.usedAt))}` : "Not used yet"}
              </p>
            </div>
          ))
        ) : (
          <p className="py-8 text-sm text-kuartz-muted">No intake links generated yet.</p>
        )}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: LinkStatus }) {
  const className =
    status === "Active"
      ? "border-[#b8ff45] bg-[#f4ffd7] text-kuartz-ink"
      : status === "Used"
        ? "border-kuartz-line bg-white text-kuartz-secondary"
        : "border-[#ead4c6] bg-[#fff4ec] text-[#9a4b21]";

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${className}`}>{status}</span>;
}
