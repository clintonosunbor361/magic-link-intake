import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveVendorAction, restoreVendorAction, updateVendorAction } from "@/app/actions/vendors";
import { SpecialtyTags, VendorJobStats, VendorScores } from "@/components/vendors/vendor-scores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaffSession } from "@/lib/auth/session";
import { mayArchive } from "@/lib/domain/record-lifecycle";
import { listVendorSpecialties } from "@/lib/vendor-specialties/repository";
import { getVendorWithStats } from "@/lib/vendors/repository";

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const [vendor, specialties] = await Promise.all([
    getVendorWithStats(session.organizationId, id),
    listVendorSpecialties(session.organizationId),
  ]);
  if (!vendor) notFound();

  const selectedSpecialtyIds = new Set(vendor.specialties.map((specialty) => specialty.id));
  const canArchive = mayArchive("vendor", session.role);
  // An archived specialty stays on the Vendor but is no longer offered; showing it as a checked box
  // would imply it can be re-selected.
  const selectableSpecialties = specialties.filter((specialty) => !specialty.archivedAt);

  return (
    <div>
      <Link
        href="/vendors"
        className="text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
      >
        ← All Vendors
      </Link>

      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Vendor</p>
        <h1 className="page-title">{vendor.name}</h1>
        {vendor.archivedAt ? (
          <p className="mt-3 text-sm font-semibold text-kuartz-muted">
            Archived — this Vendor cannot be selected for new assignments.
          </p>
        ) : null}
      </header>

      {query.error ? (
        <p className="form-alert mt-6" role="alert">
          {query.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <div>
            <h2 className="section-title">Performance</h2>
            <div className="mt-4 grid gap-3 border-y border-kuartz-line py-5">
              <VendorScores summary={vendor.ratingSummary} />
              <VendorJobStats
                completedJobs={vendor.completedJobs}
                openJobs={vendor.openJobs}
                lastJobDate={vendor.lastJobDate}
              />
            </div>
          </div>

          <div>
            <h2 className="section-title">Specialties</h2>
            <div className="mt-4">
              <SpecialtyTags specialties={vendor.specialties} />
            </div>
          </div>

          <div>
            <h2 className="section-title">Contact</h2>
            <dl className="mt-4 grid gap-4 border-y border-kuartz-line py-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Phone</dt>
                <dd className="mt-1 text-kuartz-ink">{vendor.phone ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Email</dt>
                <dd className="mt-1 text-kuartz-ink">{vendor.email ?? "Not recorded"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Address</dt>
                <dd className="mt-1 text-kuartz-ink">{vendor.address ?? "Not recorded"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="space-y-8">
          <div>
            <h2 className="section-title">Edit Vendor</h2>
            <form action={updateVendorAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
              <input type="hidden" name="vendorId" value={vendor.id} />
              <input type="hidden" name="version" value={vendor.version} />
              <label className="form-group">
                <span>Name</span>
                <Input name="name" defaultValue={vendor.name} required maxLength={120} />
              </label>
              <label className="form-group">
                <span>
                  Phone <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <Input name="phone" type="tel" defaultValue={vendor.phone ?? ""} />
              </label>
              <label className="form-group">
                <span>
                  Email <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <Input name="email" type="email" defaultValue={vendor.email ?? ""} />
              </label>
              <label className="form-group">
                <span>
                  Address <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <Input name="address" defaultValue={vendor.address ?? ""} maxLength={200} />
              </label>

              {selectableSpecialties.length ? (
                <fieldset className="form-group">
                  <legend>Specialties</legend>
                  <div className="grid gap-2 pt-1">
                    {selectableSpecialties.map((specialty) => (
                      <label
                        key={specialty.id}
                        className="flex items-center gap-2.5 text-sm font-medium text-kuartz-body"
                      >
                        <input
                          type="checkbox"
                          name="specialtyIds"
                          value={specialty.id}
                          defaultChecked={selectedSpecialtyIds.has(specialty.id)}
                          className="h-4 w-4 cursor-pointer accent-[#88925f]"
                        />
                        {specialty.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <Button className="w-full" type="submit">
                Save Vendor
              </Button>
            </form>
          </div>

          {canArchive ? (
            <div>
              <h2 className="section-title">{vendor.archivedAt ? "Restore" : "Archive"}</h2>
              <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
                {vendor.archivedAt
                  ? "Restoring makes this Vendor selectable for new assignments again."
                  : "Archiving hides this Vendor from assignment pickers. Existing assignments and their history are untouched."}
              </p>
              <form action={vendor.archivedAt ? restoreVendorAction : archiveVendorAction} className="mt-4">
                <input type="hidden" name="vendorId" value={vendor.id} />
                <input type="hidden" name="version" value={vendor.version} />
                <Button type="submit" variant="outline" className="w-full">
                  {vendor.archivedAt ? "Restore Vendor" : "Archive Vendor"}
                </Button>
              </form>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
