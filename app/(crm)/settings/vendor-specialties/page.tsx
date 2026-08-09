import { redirect } from "next/navigation";
import {
  archiveVendorSpecialtyAction,
  createVendorSpecialtyAction,
  restoreVendorSpecialtyAction,
} from "@/app/actions/vendor-specialties";
import { SettingsNav } from "@/components/settings-nav";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageVendorSpecialties } from "@/lib/domain/access-control";
import { listVendorSpecialties } from "@/lib/vendor-specialties/repository";

export default async function VendorSpecialtiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageVendorSpecialties(session.role)) redirect("/");

  const [specialties, params] = await Promise.all([
    listVendorSpecialties(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = specialties.length ? Math.max(...specialties.map((row) => row.sortOrder)) + 1 : 0;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Vendor specialties</h1>
        <p className="page-description">
          Manage the specialty tags staff can attach to a Vendor. Archiving a tag removes it from
          selection but leaves it on the Vendors already tagged with it.
        </p>
      </header>

      <SettingsNav current="/settings/vendor-specialties" />

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="section-title">Configured specialties</h2>
          {specialties.length ? (
            <div role="list" className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
              {specialties.map((specialty) => (
                <div
                  key={specialty.id}
                  role="listitem"
                  aria-label={specialty.name}
                  className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-kuartz-ink">{specialty.name}</p>
                    {specialty.archivedAt ? (
                      <p className="mt-1 text-sm text-kuartz-muted">Archived</p>
                    ) : null}
                  </div>
                  <form action={specialty.archivedAt ? restoreVendorSpecialtyAction : archiveVendorSpecialtyAction}>
                    <input type="hidden" name="specialtyId" value={specialty.id} />
                    <input type="hidden" name="version" value={specialty.version} />
                    <Button
                      type="submit"
                      variant="outline"
                      aria-label={`${specialty.archivedAt ? "Restore" : "Archive"} ${specialty.name}`}
                    >
                      {specialty.archivedAt ? "Restore" : "Archive"}
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              title="No specialties yet"
              description="Add the garment types your Vendors work on, such as Agbada or Embroidery, so assignment pickers can show who does what."
            />
          )}
        </div>

        <aside>
          <h2 className="section-title">Add a specialty</h2>
          <form action={createVendorSpecialtyAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required maxLength={80} />
            </label>
            <Button className="w-full" type="submit">
              Add specialty
            </Button>
          </form>
        </aside>
      </section>
    </div>
  );
}
