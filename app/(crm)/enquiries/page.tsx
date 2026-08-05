import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/session";
import { listEnquiries } from "@/lib/enquiries/repository";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkGenerator } from "@/components/link-generator";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default async function EnquiriesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; includeArchived?: string; page?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { enquiries, hasNextPage } = await listEnquiries(session.organizationId, {
    search: params.search,
    includeArchived: params.includeArchived === "1",
    page,
  });

  return (
    <div>
      <header className="grid gap-8 border-b border-[#d9d8d1] pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="eyebrow">Enquiries</p>
          <h1 className="page-title">Inbox</h1>
          <p className="page-description">
            Everyone who has contacted Kuartz but has not yet agreed an Order.
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 lg:items-end">
          <Button asChild>
            <Link href="/enquiries/new">New Enquiry</Link>
          </Button>
          <LinkGenerator />
        </div>
      </header>

      <form method="get" className="mt-8 flex flex-wrap items-center gap-4">
        <input
          type="search"
          name="search"
          defaultValue={params.search ?? ""}
          placeholder="Search by name, phone, or email"
          className="min-h-[3.1rem] w-full max-w-sm rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-[#50586c]">
          <input type="checkbox" name="includeArchived" value="1" defaultChecked={params.includeArchived === "1"} />
          Include archived
        </label>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <section className="mt-9">
        {enquiries.length ? (
          <div className="overflow-x-auto border-y border-[#d9d8d1]">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs text-[#50586c]">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="pl-4 py-3 font-semibold">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d9d8d1]">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td className="py-4 pr-4 font-semibold text-[#171b36]">
                      <Link href={`/enquiries/${enquiry.id}`} className="hover:underline">
                        {enquiry.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-[#50586c]">{enquiry.primaryPhone}</td>
                    <td className="px-4 py-4 text-[#171b36]">{enquiry.eventType}</td>
                    <td className="px-4 py-4 text-[#50586c]">
                      {enquiry.channel === "external_form" ? "External" : "Internal"}
                    </td>
                    <td className="px-4 py-4 text-[#50586c]">
                      {enquiry.convertedAt ? "Converted" : enquiry.archivedAt ? "Archived" : "Open"}
                    </td>
                    <td className="pl-4 py-4 text-[#50586c]">{dateFormatter.format(enquiry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            title="No Enquiries yet"
            description="Generate an intake link or create an internal Enquiry to get started."
          />
        )}
        {enquiries.length && (page > 1 || hasNextPage) ? (
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
            <span className="text-sm text-[#50586c]">Page {page}</span>
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
  params: { search?: string; includeArchived?: string },
  page: number,
): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeArchived === "1") query.set("includeArchived", "1");
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/enquiries?${queryString}` : "/enquiries";
}
