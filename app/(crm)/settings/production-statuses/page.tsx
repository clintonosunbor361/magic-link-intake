import { CircleCheck } from "lucide-react";
import { redirect } from "next/navigation";
import {
  archiveProductionStatusAction,
  createProductionStatusAction,
  restoreProductionStatusAction,
  setProductionStatusCompletedAction,
} from "@/app/actions/production-statuses";
import { SettingsNav } from "@/components/settings-nav";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageProductionStatuses } from "@/lib/domain/access-control";
import { listProductionStatuses } from "@/lib/production-statuses/repository";

export default async function ProductionStatusesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageProductionStatuses(session.role)) redirect("/");

  const [statuses, params] = await Promise.all([
    listProductionStatuses(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = statuses.length ? Math.max(...statuses.map((row) => row.sortOrder)) + 1 : 0;
  const liveCompletedCount = statuses.filter((status) => status.isCompleted && !status.archivedAt).length;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Production statuses</h1>
        <p className="page-description">
          One shared list applies to every Vendor assignment. The first status in this order is where
          new assignments start, and at least one status must be marked as completed.
        </p>
      </header>

      <SettingsNav current="/settings/production-statuses" />

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="section-title">Configured statuses</h2>
          {statuses.length ? (
            <div role="list" className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
              {statuses.map((status, index) => (
                <div
                  key={status.id}
                  role="listitem"
                  aria-label={status.name}
                  className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-kuartz-ink">
                      {status.name}
                      {status.isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#cadfb0] bg-[#f2f8e8] px-2 py-0.5 text-xs font-semibold text-[#4a6320]">
                          <CircleCheck size={12} strokeWidth={2} aria-hidden="true" />
                          Counts as completed
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-kuartz-muted">
                      {status.archivedAt
                        ? "Archived"
                        : index === 0
                          ? "Starting status for new assignments"
                          : `Position ${index + 1}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={setProductionStatusCompletedAction}>
                      <input type="hidden" name="statusId" value={status.id} />
                      <input type="hidden" name="version" value={status.version} />
                      <input type="hidden" name="isCompleted" value={status.isCompleted ? "false" : "true"} />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={status.isCompleted && liveCompletedCount < 2}
                        aria-label={`${status.isCompleted ? "Stop counting" : "Count"} ${status.name} as completed`}
                      >
                        {status.isCompleted ? "Not completed" : "Mark completed"}
                      </Button>
                    </form>
                    <form action={status.archivedAt ? restoreProductionStatusAction : archiveProductionStatusAction}>
                      <input type="hidden" name="statusId" value={status.id} />
                      <input type="hidden" name="version" value={status.version} />
                      <Button
                        type="submit"
                        variant="outline"
                        aria-label={`${status.archivedAt ? "Restore" : "Archive"} ${status.name}`}
                      >
                        {status.archivedAt ? "Restore" : "Archive"}
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              title="No production statuses yet"
              description="Add at least one status, including one that counts as completed, before assigning Vendors to Items."
            />
          )}
        </div>

        <aside>
          <h2 className="section-title">Add a status</h2>
          <form action={createProductionStatusAction} className="mt-4 space-y-4 border-t border-kuartz-line pt-5">
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required maxLength={80} />
            </label>
            <label className="flex items-start gap-3 text-sm font-semibold text-kuartz-body">
              <input
                type="checkbox"
                name="isCompleted"
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#88925f]"
              />
              <span>
                Counts as completed
                <small className="mt-0.5 block font-medium text-kuartz-subtle">
                  Assignments at this status count as completed jobs on the Vendor picker.
                </small>
              </span>
            </label>
            <Button className="w-full" type="submit">
              Add status
            </Button>
          </form>
        </aside>
      </section>
    </div>
  );
}
