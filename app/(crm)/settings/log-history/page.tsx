import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/domain/access-control";
import { listAuditEntries } from "@/lib/team/repository";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export default async function LogHistoryPage() {
  const session = await requireStaffSession();
  if (!canManageTeam(session.role)) redirect("/");

  const entries = await listAuditEntries(session.organizationId);

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Log history</h1>
        <p className="page-description">Review recent activity across the organization.</p>
      </header>

      <SettingsNav current="/settings/log-history" />

      <section className="mt-9">
        <h2 className="section-title">Recent activity</h2>
        <div className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
          {entries.length ? (
            entries.map((entry) => (
              <div key={entry.id} className="grid gap-1 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="font-medium text-kuartz-ink">{entry.summary}</p>
                <p className="text-kuartz-muted">
                  {entry.actorName ?? "System"} · {dateFormatter.format(entry.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="py-8 text-sm text-kuartz-muted">No activity has been recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
