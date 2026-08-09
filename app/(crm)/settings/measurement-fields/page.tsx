import Link from "next/link";
import { redirect } from "next/navigation";
import {
  archiveMeasurementFieldDefinitionAction,
  createMeasurementFieldDefinitionAction,
  restoreMeasurementFieldDefinitionAction,
} from "@/app/actions/measurement-field-definitions";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageMeasurementFieldDefinitions } from "@/lib/domain/access-control";
import { listMeasurementFieldDefinitions } from "@/lib/measurement-field-definitions/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function MeasurementFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageMeasurementFieldDefinitions(session.role)) redirect("/");
  const [fields, params] = await Promise.all([
    listMeasurementFieldDefinitions(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = fields.length ? Math.max(...fields.map((field) => field.sortOrder)) + 1 : 0;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Measurement fields</h1>
        <p className="page-description">
          Manage the list of measurement fields staff can record on a Client's measurement profile.
        </p>
      </header>

      <nav className="mt-6 flex gap-4 text-sm font-semibold">
        <Link href="/settings/team" className="text-kuartz-secondary hover:text-kuartz-ink">
          Team
        </Link>
        <Link href="/settings/item-types" className="text-kuartz-secondary hover:text-kuartz-ink">
          Item types
        </Link>
        <Link href="/settings/consultation-note-sources" className="text-kuartz-secondary hover:text-kuartz-ink">
          Consultation note sources
        </Link>
        <Link href="/settings/measurement-fields" className="text-kuartz-ink underline">
          Measurement fields
        </Link>
        <Link href="/settings/measurement-requirements" className="text-kuartz-secondary hover:text-kuartz-ink">
          Measurement requirements
        </Link>
      </nav>

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="section-title">Configured fields</h2>
          <div role="list" className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {fields.map((field) => (
              <div
                key={field.id}
                role="listitem"
                aria-label={field.name}
                className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <p className="font-semibold text-kuartz-ink">
                    {field.name} <span className="font-normal text-kuartz-muted">({field.unit})</span>
                  </p>
                  {field.archivedAt ? <p className="mt-1 text-sm text-kuartz-muted">Archived</p> : null}
                </div>
                <form
                  action={field.archivedAt ? restoreMeasurementFieldDefinitionAction : archiveMeasurementFieldDefinitionAction}
                >
                  <input type="hidden" name="fieldDefinitionId" value={field.id} />
                  <input type="hidden" name="version" value={field.version} />
                  <Button
                    type="submit"
                    variant="outline"
                    aria-label={`${field.archivedAt ? "Restore" : "Archive"} ${field.name}`}
                  >
                    {field.archivedAt ? "Restore" : "Archive"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
        <aside>
          <h2 className="section-title">Add a field</h2>
          <form action={createMeasurementFieldDefinitionAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required />
            </label>
            <label className="form-group">
              <span>Unit</span>
              <Input name="unit" placeholder="e.g. in, cm, UK" required />
            </label>
            <Button className="w-full" type="submit">
              Add field
            </Button>
          </form>
        </aside>
      </section>
    </div>
  );
}
