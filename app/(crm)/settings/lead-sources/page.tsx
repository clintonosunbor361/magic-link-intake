import { redirect } from "next/navigation";
import {
  archiveLeadSourceAction,
  createLeadSourceAction,
  restoreLeadSourceAction,
} from "@/app/actions/lead-sources";
import { SettingsNav } from "@/components/settings-nav";
import { Button } from "@/components/ui/button";
import { FormDisclosure } from "@/components/ui/form-disclosure";
import { Input } from "@/components/ui/input";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageLeadSources } from "@/lib/domain/access-control";
import { listLeadSources } from "@/lib/lead-sources/repository";

export default async function LeadSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageLeadSources(session.role)) redirect("/");
  const [sources, params] = await Promise.all([
    listLeadSources(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = sources.length ? Math.max(...sources.map((source) => source.sortOrder)) + 1 : 0;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Lead sources</h1>
        <p className="page-description">
          Manage the list staff can select from when capturing where a Client came from.
        </p>
      </header>

      <SettingsNav current="/settings/lead-sources" />

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
                <form action={source.archivedAt ? restoreLeadSourceAction : archiveLeadSourceAction}>
                  <input type="hidden" name="leadSourceId" value={source.id} />
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
          <FormDisclosure title="Lead sources" buttonLabel="Add lead source">
            <form action={createLeadSourceAction} className="space-y-4 border-t border-kuartz-line pt-5">
              <input type="hidden" name="sortOrder" value={nextSortOrder} />
              <label className="form-group">
                <span>Name</span>
                <Input name="name" required />
              </label>
              <Button className="w-full" type="submit">
                Add lead source
              </Button>
            </form>
          </FormDisclosure>
        </aside>
      </section>
    </div>
  );
}
