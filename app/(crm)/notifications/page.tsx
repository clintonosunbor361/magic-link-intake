import Link from "next/link";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { listNotifications } from "@/lib/notifications/repository";
import { TRIGGER_LABELS } from "@/lib/notifications/triggers";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { computeUrgencyBand, urgencyToneClasses } from "@/lib/production/urgency";

const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

const SOURCE_LABELS: Record<string, string> = {
  client_task: "To-do",
  vendor_assignment: "Production",
  accessory_item: "Accessory",
  fitting_session: "Fitting",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireStaffSession();
  const { filter } = await searchParams;
  const unreadOnly = filter !== "all";

  const [rows, timezone] = await Promise.all([
    listNotifications(session.organizationId, { unreadOnly }),
    getOrganizationTimezone(session.organizationId),
  ]);
  const today = businessToday(timezone);

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Notifications</p>
        <h1 className="page-title">Deadline reminders</h1>
        <p className="page-description">
          Reminders fire 7, 3 and 1 days before a deadline and once when it passes. Everyone sees
          every reminder here; the email goes to whoever owns the work.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <nav className="flex gap-4 text-sm font-semibold" aria-label="Notification filter">
          <Link
            href="/notifications"
            aria-current={unreadOnly ? "page" : undefined}
            className={
              unreadOnly
                ? "text-kuartz-ink underline decoration-2 underline-offset-4"
                : "text-kuartz-secondary transition-colors duration-200 hover:text-kuartz-ink"
            }
          >
            Unread
          </Link>
          <Link
            href="/notifications?filter=all"
            aria-current={!unreadOnly ? "page" : undefined}
            className={
              !unreadOnly
                ? "text-kuartz-ink underline decoration-2 underline-offset-4"
                : "text-kuartz-secondary transition-colors duration-200 hover:text-kuartz-ink"
            }
          >
            All
          </Link>
        </nav>

        {rows.some((row) => !row.readAt) ? (
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="returnTo" value={unreadOnly ? "/notifications" : "/notifications?filter=all"} />
            <Button type="submit" variant="outline">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      {rows.length ? (
        <section className="mt-6 divide-y divide-kuartz-line border-y border-kuartz-line">
          {rows.map((row) => {
            const band = computeUrgencyBand({ deadline: row.dueDate, today });
            return (
              <article
                key={row.id}
                aria-label={row.title}
                className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-kuartz-line bg-[#f6f6f3] px-2.5 py-0.5 text-xs font-semibold text-kuartz-secondary">
                      {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${urgencyToneClasses(band)}`}
                    >
                      {TRIGGER_LABELS[row.trigger]}
                    </span>
                    {!row.readAt ? (
                      <span className="rounded-full border border-kuartz-ink px-2.5 py-0.5 text-xs font-semibold text-kuartz-ink">
                        Unread
                      </span>
                    ) : null}
                    {row.emailState === "failed" ? (
                      <span className="rounded-full border border-[#f0b4b4] bg-[#fdf0f0] px-2.5 py-0.5 text-xs font-semibold text-[#8c1d1d]">
                        Email failed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-semibold text-kuartz-ink">
                    <Link href={row.href} className="underline-offset-4 hover:underline">
                      {row.title}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-kuartz-secondary">{row.body}</p>
                  <p className="mt-1 text-xs text-kuartz-muted">
                    {dateTimeFormatter.format(row.createdAt)}
                    {row.recipientName ? ` · ${row.recipientName}` : " · unassigned"}
                  </p>
                </div>

                {!row.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={row.id} />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={unreadOnly ? "/notifications" : "/notifications?filter=all"}
                    />
                    <Button type="submit" variant="outline" aria-label={`Mark "${row.title}" as read`}>
                      Mark read
                    </Button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          className="mt-6"
          title={unreadOnly ? "Nothing unread" : "No notifications yet"}
          description={
            unreadOnly
              ? "Every reminder has been dealt with."
              : "Reminders appear here as deadlines approach across to-dos, production, accessories and fittings."
          }
        />
      )}
    </div>
  );
}
