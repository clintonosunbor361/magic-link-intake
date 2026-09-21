import Link from "next/link";
import { Search } from "lucide-react";
import { createVendorAction } from "@/app/actions/vendors";
import { SpecialtyTags, VendorScores } from "@/components/vendors/vendor-scores";
import { VendorDirectoryHeader } from "@/components/vendors/vendor-directory-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import { requireStaffSession } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/domain/business-date";
import { listVendorSpecialties } from "@/lib/vendor-specialties/repository";
import { listPendingRatingPrompts } from "@/lib/vendors/rating-repository";
import { listVendorsWithStats, type VendorListRow } from "@/lib/vendors/repository";

type VendorSort = "vendor" | "specialties" | "rating" | "open" | "completed" | "lastJob";
type SortDirection = "asc" | "desc";

function parseVendorSort(value: string | undefined): VendorSort {
  return ["vendor", "specialties", "rating", "open", "completed", "lastJob"].includes(value ?? "")
    ? (value as VendorSort)
    : "vendor";
}

function parseSortDirection(value: string | undefined): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string; error?: string; sort?: string; direction?: string; modal?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const includeArchived = params.archived === "1";
  const sort = parseVendorSort(params.sort);
  const direction = parseSortDirection(params.direction);

  const [vendorRows, specialties, pendingRatings] = await Promise.all([
    listVendorsWithStats(session.organizationId, { search: params.q, includeArchived }),
    listVendorSpecialties(session.organizationId),
    listPendingRatingPrompts(session.organizationId),
  ]);
  const vendors = sortVendors(vendorRows, sort, direction);

  return (
    <div>
      <VendorDirectoryHeader error={params.modal === "vendor" ? params.error : undefined}>
        <form id="add-vendor-form" action={createVendorAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="returnTo" value="/vendors" />
          <label className="form-group">
            <span>Name <span className="font-normal text-kuartz-secondary">(required)</span></span>
            <Input name="name" required maxLength={120} autoComplete="name" data-modal-autofocus />
          </label>
          <label className="form-group">
            <span>Phone <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <Input name="phone" type="tel" autoComplete="tel" />
          </label>
          <label className="form-group">
            <span>Email <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <Input name="email" type="email" autoComplete="email" />
          </label>
          <label className="form-group">
            <span>Address <span className="font-normal text-kuartz-secondary">(optional)</span></span>
            <Input name="address" maxLength={200} autoComplete="street-address" />
          </label>

          {specialties.length ? (
            <fieldset className="form-group sm:col-span-2">
              <legend>Specialties <span className="font-normal text-kuartz-secondary">(optional)</span></legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
                {specialties.map((specialty) => (
                  <label key={specialty.id} className="flex items-center gap-2.5 text-sm font-medium text-kuartz-body">
                    <input
                      type="checkbox"
                      name="specialtyIds"
                      value={specialty.id}
                      className="h-4 w-4 cursor-pointer accent-[#88925f]"
                    />
                    {specialty.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </form>
      </VendorDirectoryHeader>

      {pendingRatings.length ? (
        <p className="mt-6 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5 text-sm leading-6 text-[#3f4a24]">
          {pendingRatings.length} Vendor rating{pendingRatings.length === 1 ? "" : "s"} still pending on
          completed Orders.{" "}
          <Link href="/vendor-ratings" className="font-semibold underline underline-offset-4">
            Review pending ratings
          </Link>
        </p>
      ) : null}

      <section className="mt-7">
        <form className="flex flex-col gap-3 border-b border-kuartz-line pb-4 lg:flex-row lg:items-center lg:justify-between" role="search">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="direction" value={direction} />
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Search by name or phone</span>
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-kuartz-muted" />
            <Input name="q" defaultValue={params.q ?? ""} type="search" placeholder="Search vendor name or phone" className="pl-10" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-[0.65rem] border border-kuartz-line bg-white px-3.5 text-sm font-semibold text-kuartz-secondary">
              <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} />
              Archived
            </label>
            <Button type="submit" variant="outline" className="gap-2">
              <Search size={16} aria-hidden="true" />
              Search
            </Button>
          </div>
        </form>

        {vendors.length ? (
          <>
            <div role="list" className="divide-y divide-kuartz-line border-b border-kuartz-line xl:hidden">
              {vendors.map((vendor) => (
                <article key={vendor.id} role="listitem" className="py-4">
                  <Link href={`/vendors/${vendor.id}`} className="font-semibold text-kuartz-ink hover:underline">
                    {vendor.name}
                  </Link>
                  {vendor.archivedAt ? <span className="ml-2 text-xs text-kuartz-muted">Archived</span> : null}
                  <div className="mt-2"><SpecialtyTags specialties={vendor.specialties} /></div>
                  <div className="mt-2"><VendorScores summary={vendor.ratingSummary} compact /></div>
                  <p className="mt-2 text-xs text-kuartz-secondary">
                    Open {vendor.openJobs} | Completed {vendor.completedJobs} | Last job {vendor.lastJobDate ? formatBusinessDate(vendor.lastJobDate) : "None yet"}
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-[0.8rem] border border-kuartz-line xl:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#f4f3f0] text-xs text-kuartz-secondary">
                  <tr>
                    <th className="py-3 pl-4 pr-4" aria-sort={sort === "vendor" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                      <SortableTableHeader href={vendorSortHref(params, "vendor")} active={sort === "vendor"} direction={direction}>Vendor</SortableTableHeader>
                    </th>
                    <th className="px-4 py-3" aria-sort={sort === "specialties" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                      <SortableTableHeader href={vendorSortHref(params, "specialties")} active={sort === "specialties"} direction={direction}>Specialties</SortableTableHeader>
                    </th>
                    <th className="px-4 py-3" aria-sort={sort === "rating" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                      <SortableTableHeader href={vendorSortHref(params, "rating")} active={sort === "rating"} direction={direction}>Rating</SortableTableHeader>
                    </th>
                    <th className="px-4 py-3" aria-sort={sort === "open" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                      <SortableTableHeader href={vendorSortHref(params, "open")} active={sort === "open"} direction={direction}>Open jobs</SortableTableHeader>
                    </th>
                    <th className="px-4 py-3" aria-sort={sort === "completed" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                      <SortableTableHeader href={vendorSortHref(params, "completed")} active={sort === "completed"} direction={direction}>Completed</SortableTableHeader>
                    </th>
                    <th className="px-4 py-3" aria-sort={sort === "lastJob" ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                      <SortableTableHeader href={vendorSortHref(params, "lastJob")} active={sort === "lastJob"} direction={direction}>Last job</SortableTableHeader>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kuartz-line bg-white/75">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="transition hover:bg-[#fbfaf7]">
                      <td className="py-3.5 pl-4 pr-4">
                        <Link href={`/vendors/${vendor.id}`} className="font-semibold text-kuartz-ink hover:underline">{vendor.name}</Link>
                        {vendor.phone ? <p className="mt-1 text-xs text-kuartz-muted">{vendor.phone}</p> : null}
                        {vendor.archivedAt ? <p className="mt-1 text-xs font-semibold text-[#9a4b21]">Archived</p> : null}
                      </td>
                      <td className="px-4 py-3.5"><SpecialtyTags specialties={vendor.specialties} /></td>
                      <td className="px-4 py-3.5"><VendorScores summary={vendor.ratingSummary} compact /></td>
                      <td className="px-4 py-3.5 font-semibold text-kuartz-ink">{vendor.openJobs}</td>
                      <td className="px-4 py-3.5 text-kuartz-secondary">{vendor.completedJobs}</td>
                      <td className="px-4 py-3.5 text-kuartz-secondary">{vendor.lastJobDate ? formatBusinessDate(vendor.lastJobDate) : "None yet"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            className="mt-4"
            title={params.q ? "No Vendors match that search" : "No Vendors yet"}
            description={params.q ? "Try a shorter search, or clear it to see the whole directory." : "Add the vendors who produce client items."}
          />
        )}
      </section>
    </div>
  );
}

function sortVendors(rows: VendorListRow[], sort: VendorSort, direction: SortDirection): VendorListRow[] {
  const sorted = [...rows].sort((left, right) => {
    let result = 0;
    if (sort === "vendor") result = left.name.localeCompare(right.name);
    if (sort === "specialties") {
      result = left.specialties.map((item) => item.name).join(", ").localeCompare(right.specialties.map((item) => item.name).join(", "));
    }
    if (sort === "rating") {
      const leftRating = left.ratingSummary.state === "rated" ? left.ratingSummary.overall : -1;
      const rightRating = right.ratingSummary.state === "rated" ? right.ratingSummary.overall : -1;
      result = leftRating - rightRating;
    }
    if (sort === "open") result = left.openJobs - right.openJobs;
    if (sort === "completed") result = left.completedJobs - right.completedJobs;
    if (sort === "lastJob") result = (left.lastJobDate ?? "").localeCompare(right.lastJobDate ?? "");
    if (result === 0) result = left.name.localeCompare(right.name);
    return direction === "asc" ? result : -result;
  });
  return sorted;
}

function vendorSortHref(
  params: { q?: string; archived?: string; sort?: string; direction?: string },
  sort: VendorSort,
): string {
  const query = new URLSearchParams();
  const currentSort = parseVendorSort(params.sort);
  const currentDirection = parseSortDirection(params.direction);
  const nextDirection: SortDirection = currentSort === sort && currentDirection === "asc" ? "desc" : "asc";
  if (params.q) query.set("q", params.q);
  if (params.archived === "1") query.set("archived", "1");
  query.set("sort", sort);
  query.set("direction", nextDirection);
  return `/vendors?${query.toString()}`;
}
