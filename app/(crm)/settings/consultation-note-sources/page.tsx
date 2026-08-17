import Link from "next/link";
import { redirect } from "next/navigation";
import {
  archiveConsultationNoteSourceAction,
  createConsultationNoteSourceAction,
  restoreConsultationNoteSourceAction,
} from "@/app/actions/consultation-note-sources";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageConsultationNoteSources } from "@/lib/domain/access-control";
import { listConsultationNoteSources } from "@/lib/consultation-note-sources/repository";
import { Button } from "@/components/ui/button";
import { FormDisclosure } from "@/components/ui/form-disclosure";
import { Input } from "@/components/ui/input";

export default async function ConsultationNoteSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageConsultationNoteSources(session.role)) redirect("/");
  const [sources, params] = await Promise.all([
    listConsultationNoteSources(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = sources.length ? Math.max(...sources.map((source) => source.sortOrder)) + 1 : 0;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Consultation note sources</h1>
        <p className="page-description">
          Manage the list of sources staff can select when adding a Consultation Note.
        </p>
      </header>

      <nav className="mt-6 flex gap-4 text-sm font-semibold">
        <Link href="/settings/team" className="text-kuartz-secondary hover:text-kuartz-ink">
          Team
        </Link>
        <Link href="/settings/item-types" className="text-kuartz-secondary hover:text-kuartz-ink">
          Item types
        </Link>
        <Link href="/settings/consultation-note-sources" className="text-kuartz-ink underline">
          Consultation note sources
        </Link>
        <Link href="/settings/measurement-fields" className="text-kuartz-secondary hover:text-kuartz-ink">
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
          <h2 className="section-title">Configured sources</h2>
          <div role="list" className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {sources.map((source) => (
              <div
                key={source.id}
                role="listitem"
                aria-label={source.name}
                className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <p className="font-semibold text-kuartz-ink">{source.name}</p>
                  {source.archivedAt ? <p className="mt-1 text-sm text-kuartz-muted">Archived</p> : null}
                </div>
                <form action={source.archivedAt ? restoreConsultationNoteSourceAction : archiveConsultationNoteSourceAction}>
                  <input type="hidden" name="sourceId" value={source.id} />
                  <input type="hidden" name="version" value={source.version} />
                  <Button
                    type="submit"
                    variant="outline"
                    aria-label={`${source.archivedAt ? "Restore" : "Archive"} ${source.name}`}
                  >
                    {source.archivedAt ? "Restore" : "Archive"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
        <aside>
          <FormDisclosure title="Sources" buttonLabel="Add source">
          <form action={createConsultationNoteSourceAction} className="space-y-4 border-t border-kuartz-line pt-5">
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required />
            </label>
            <Button className="w-full" type="submit">
              Add source
            </Button>
          </form>
          </FormDisclosure>
        </aside>
      </section>
    </div>
  );
}
