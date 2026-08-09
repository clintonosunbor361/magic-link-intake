import Link from "next/link";
import { createVendorAction } from "@/app/actions/vendors";
import { SpecialtyTags, VendorJobStats, VendorScores } from "@/components/vendors/vendor-scores";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireStaffSession } from "@/lib/auth/session";
import { listVendorSpecialties } from "@/lib/vendor-specialties/repository";
import { listPendingRatingPrompts } from "@/lib/vendors/rating-repository";
import { listVendorsWithStats } from "@/lib/vendors/repository";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string; error?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const includeArchived = params.archived === "1";

  const [vendors, specialties, pendingRatings] = await Promise.all([
    listVendorsWithStats(session.organizationId, { search: params.q, includeArchived }),
    listVendorSpecialties(session.organizationId),
    listPendingRatingPrompts(session.organizationId),
  ]);

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Directory</p>
        <h1 className="page-title">Vendors</h1>
        <p className="page-description">
          The people who produce your Items. Scores and job counts here are what the assignment
          picker shows when you choose who makes what.
        </p>
      </header>

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      {pendingRatings.length ? (
        <p className="mt-6 border-l-[3px] border-[#88925f] bg-white/70 px-4 py-3.5 text-sm leading-6 text-[#3f4a24]">
          {pendingRatings.length} Vendor rating{pendingRatings.length === 1 ? "" : "s"} still pending on
          completed Orders.{" "}
          <Link href="/vendor-ratings" className="font-semibold underline underline-offset-4">
            Review pending ratings
          </Link>
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="form-group min-w-[14rem] flex-1">
              <span>Search by name or phone</span>
              <Input name="q" defaultValue={params.q ?? ""} type="search" placeholder="Tunde" />
            </label>
            {includeArchived ? <input type="hidden" name="archived" value="1" /> : null}
            <Button type="submit" variant="outline">
              Search
            </Button>
            <Link
              href={includeArchived ? "/vendors" : "/vendors?archived=1"}
              className="min-h-[2.75rem] self-center text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
            >
              {includeArchived ? "Hide archived" : "Show archived"}
            </Link>
          </form>

          <h2 className="section-title mt-8">
            {vendors.length} {vendors.length === 1 ? "Vendor" : "Vendors"}
          </h2>

          {vendors.length ? (
            <div role="list" className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
              {vendors.map((vendor) => (
                <article key={vendor.id} role="listitem" className="grid gap-3 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
                  <div>
                    <h3 className="text-base font-semibold text-kuartz-ink">
                      <Link
                        href={`/vendors/${vendor.id}`}
                        className="underline-offset-4 transition-colors duration-200 hover:underline"
                      >
                        {vendor.name}
                      </Link>
                      {vendor.archivedAt ? (
                        <span className="ml-2 text-sm font-medium text-kuartz-muted">Archived</span>
                      ) : null}
                    </h3>
                    <div className="mt-2">
                      <SpecialtyTags specialties={vendor.specialties} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <VendorScores summary={vendor.ratingSummary} />
                    <VendorJobStats
                      completedJobs={vendor.completedJobs}
                      openJobs={vendor.openJobs}
                      lastJobDate={vendor.lastJobDate}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              title={params.q ? "No Vendors match that search" : "No Vendors yet"}
              description={
                params.q
                  ? "Try a shorter search, or clear it to see the whole directory."
                  : "Add the workshops and tailors who produce your Items. You can also quick-create one while assigning an Item."
              }
            />
          )}
        </div>

        <aside>
          <h2 className="section-title">Add a Vendor</h2>
          <form action={createVendorAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
            <input type="hidden" name="returnTo" value="/vendors" />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required maxLength={120} />
            </label>
            <label className="form-group">
              <span>
                Phone <span className="font-normal text-kuartz-secondary">(optional)</span>
              </span>
              <Input name="phone" type="tel" autoComplete="off" />
            </label>
            <label className="form-group">
              <span>
                Email <span className="font-normal text-kuartz-secondary">(optional)</span>
              </span>
              <Input name="email" type="email" autoComplete="off" />
            </label>
            <label className="form-group">
              <span>
                Address <span className="font-normal text-kuartz-secondary">(optional)</span>
              </span>
              <Input name="address" maxLength={200} />
            </label>

            {specialties.length ? (
              <fieldset className="form-group">
                <legend>
                  Specialties <span className="font-normal text-kuartz-secondary">(optional)</span>
                </legend>
                <div className="grid gap-2 pt-1">
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

            <Button className="w-full" type="submit">
              Add Vendor
            </Button>
          </form>
        </aside>
      </section>
    </div>
  );
}
