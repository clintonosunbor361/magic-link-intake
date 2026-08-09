import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Greeting } from "@/components/greeting";
import { WeekdayLabel } from "@/components/weekday-label";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffSession } from "@/lib/auth/session";
import {
  countActiveClients,
  dashboardToday,
  listDelayedAssignments,
  listDueFollowUps,
  listPendingApprovals,
  listUpcomingFittings,
  listUpcomingLookDates,
} from "@/lib/dashboard/repository";
import { daysBetween } from "@/lib/domain/business-date";
import { listOrderBalances, listVendorPaymentPositions } from "@/lib/finance/repository";
import { formatMinorUnits } from "@/lib/forms/money";
import { countUnreadNotifications, listNotifications } from "@/lib/notifications/repository";
import { TRIGGER_LABELS } from "@/lib/notifications/triggers";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { computeUrgencyBand, urgencyToneClasses } from "@/lib/production/urgency";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const PANEL_LIMIT = 5;

export default async function OverviewPage() {
  const session = await requireStaffSession();
  const timezone = await getOrganizationTimezone(session.organizationId);
  const now = new Date();
  const today = dashboardToday(timezone, now);

  const [
    activeClients,
    upcomingLooks,
    upcomingFittings,
    delayed,
    pendingApprovals,
    followUps,
    balances,
    vendorPositions,
    recentNotifications,
    unreadCount,
  ] = await Promise.all([
    countActiveClients(session.organizationId),
    listUpcomingLookDates(session.organizationId, today),
    listUpcomingFittings(session.organizationId, now),
    listDelayedAssignments(session.organizationId, today),
    listPendingApprovals(session.organizationId),
    listDueFollowUps(session.organizationId, today),
    listOrderBalances(session.organizationId),
    listVendorPaymentPositions(session.organizationId),
    listNotifications(session.organizationId, { unreadOnly: true, limit: PANEL_LIMIT }),
    countUnreadNotifications(session.organizationId),
  ]);

  const outstanding = balances.filter((row) => row.balance.state === "invoiced" && row.balance.balanceMinor > 0);
  const totalOutstandingMinor = outstanding.reduce(
    (total, row) => total + (row.balance.state === "invoiced" ? row.balance.balanceMinor : 0),
    0,
  );
  const owedToVendors = vendorPositions.filter(
    (row) => row.position.state === "agreed" && row.position.owedMinor > 0,
  );
  const totalOwedMinor = owedToVendors.reduce(
    (total, row) => total + (row.position.state === "agreed" ? row.position.owedMinor : 0),
    0,
  );

  const metrics = [
    { label: "Active clients", value: String(activeClients), href: "/clients", hint: "with a live Order" },
    {
      label: "Behind schedule",
      value: String(delayed.length),
      href: "/production",
      hint: delayed.length ? "past deadline" : "all on track",
    },
    {
      label: "Pending approvals",
      value: String(pendingApprovals.length),
      href: "/orders",
      hint: "awaiting the client",
    },
    {
      label: "Follow-ups due",
      value: String(followUps.length),
      href: "/enquiries",
      hint: "due or overdue",
    },
    {
      label: "Owed by clients",
      value: `₦${formatMinorUnits(totalOutstandingMinor)}`,
      href: "/finance",
      hint: `${outstanding.length} Order${outstanding.length === 1 ? "" : "s"}`,
    },
    {
      label: "Owed to vendors",
      value: `₦${formatMinorUnits(totalOwedMinor)}`,
      href: "/finance",
      hint: `${owedToVendors.length} assignment${owedToVendors.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div>
      <header className="grid gap-8 border-b border-kuartz-line pb-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="eyebrow">
            <WeekdayLabel />
          </p>
          <h1 className="page-title">
            <Greeting name={session.fullName.split(" ")[0]} />
          </h1>
          <p className="page-description">
            Everything due, late, or waiting on someone — across {session.organizationName}.
          </p>
        </div>
        {unreadCount ? (
          <Link
            href="/notifications"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-kuartz-ink bg-white/70 px-4 py-2 text-xs font-semibold text-kuartz-ink transition-colors duration-200 hover:bg-kuartz-ink hover:text-white"
          >
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
            <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-kuartz-line bg-white/55 px-4 py-2 text-xs font-semibold text-[#596071]">
            <span className="h-2 w-2 rounded-full bg-[#93aa53]" />
            Nothing unread
          </span>
        )}
      </header>

      <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Key figures">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="group border border-kuartz-line bg-white/50 px-5 py-4 transition-colors duration-200 hover:border-kuartz-ink"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-kuartz-ink">{metric.value}</p>
            <p className="mt-1 text-sm text-kuartz-secondary">{metric.hint}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <div className="space-y-10">
          <Panel
            title="Behind schedule"
            href="/production"
            linkLabel="Production"
            empty="Nothing is past its deadline."
            rows={delayed.slice(0, PANEL_LIMIT).map((row) => ({
              key: row.assignmentId,
              href: `/production/${row.assignmentId}`,
              primary: row.itemLabel ?? row.itemTypeName,
              secondary: `${row.vendorName} · ${row.clientName} · ${row.statusName}`,
              badge: {
                text: `Overdue by ${Math.abs(daysBetween(today, row.deadline))}d`,
                tone: urgencyToneClasses("overdue"),
              },
            }))}
            total={delayed.length}
          />

          <Panel
            title="Upcoming events"
            href="/orders"
            linkLabel="Orders"
            empty="No Look dates in the next 60 days."
            rows={upcomingLooks.slice(0, PANEL_LIMIT).map((row) => ({
              key: row.lookId,
              href: `/orders/${row.orderId}`,
              primary: `${row.orderTitle} · ${row.lookName}`,
              secondary: row.clientName,
              badge: row.lookDate
                ? {
                    text: countdownLabel(daysBetween(today, row.lookDate)),
                    tone: urgencyToneClasses(computeUrgencyBand({ deadline: row.lookDate, today })),
                  }
                : undefined,
            }))}
            total={upcomingLooks.length}
          />

          <Panel
            title="Upcoming fittings"
            href="/orders"
            linkLabel="Orders"
            empty="No fittings scheduled in the next 30 days."
            rows={upcomingFittings.slice(0, PANEL_LIMIT).map((row) => ({
              key: row.id,
              href: `/orders/${row.orderId}/fittings`,
              primary: row.lookName ? `${row.orderTitle} · ${row.lookName}` : row.orderTitle,
              secondary: `${row.clientName} · ${dateTimeFormatter.format(row.scheduledAt)}`,
            }))}
            total={upcomingFittings.length}
          />

          <Panel
            title="Follow-ups due"
            href="/enquiries"
            linkLabel="Enquiries"
            empty="No follow-ups due."
            rows={followUps.slice(0, PANEL_LIMIT).map((row) => ({
              key: row.id,
              href: `/enquiries/${row.enquiryId}`,
              primary: row.title,
              secondary: `${row.enquiryName} · ${row.assigneeName}`,
              badge: {
                text: countdownLabel(daysBetween(today, row.dueDate)),
                tone: urgencyToneClasses(computeUrgencyBand({ deadline: row.dueDate, today })),
              },
            }))}
            total={followUps.length}
          />
        </div>

        <aside className="space-y-10">
          <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="section-title">Notifications</h2>
              <Link href="/notifications" className="text-sm font-semibold text-kuartz-ink underline">
                All
              </Link>
            </div>
            {recentNotifications.length ? (
              <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                {recentNotifications.map((row) => (
                  <li key={row.id} className="py-3">
                    <p className="text-sm font-semibold text-kuartz-ink">
                      <Link href={row.href} className="underline-offset-4 hover:underline">
                        {row.title}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-kuartz-muted">
                      {TRIGGER_LABELS[row.trigger]} · {row.dueDate}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 border-y border-kuartz-line py-5 text-sm text-kuartz-muted">
                Nothing unread.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="section-title">Pending approvals</h2>
              <Link href="/orders" className="text-sm font-semibold text-kuartz-ink underline">
                Orders
              </Link>
            </div>
            {pendingApprovals.length ? (
              <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
                {pendingApprovals.slice(0, PANEL_LIMIT).map((row) => (
                  <li key={row.fileId} className="py-3">
                    <p className="text-sm font-semibold text-kuartz-ink">
                      <Link href={`/orders/${row.orderId}`} className="underline-offset-4 hover:underline">
                        {row.orderTitle}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-kuartz-muted">
                      {row.clientName} · sent {dateFormatter.format(row.updatedAt)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 border-y border-kuartz-line py-5 text-sm text-kuartz-muted">
                Nothing awaiting a client decision.
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function countdownLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return "Today";
  if (daysRemaining === 1) return "Tomorrow";
  return `In ${daysRemaining}d`;
}

type PanelRow = {
  key: string;
  href: string;
  primary: string;
  secondary: string;
  badge?: { text: string; tone: string };
};

function Panel({
  title,
  href,
  linkLabel,
  empty,
  rows,
  total,
}: {
  title: string;
  href: string;
  linkLabel: string;
  empty: string;
  rows: PanelRow[];
  total: number;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h2 className="section-title">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-kuartz-ink underline">
          {linkLabel}
        </Link>
      </div>
      {rows.length ? (
        <>
          <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {rows.map((row) => (
              <li key={row.key} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-kuartz-ink">
                    <Link href={row.href} className="underline-offset-4 hover:underline">
                      {row.primary}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-kuartz-secondary">{row.secondary}</p>
                </div>
                {row.badge ? (
                  <span
                    className={`w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${row.badge.tone}`}
                  >
                    {row.badge.text}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {total > rows.length ? (
            <p className="mt-3 text-sm text-kuartz-muted">
              {total - rows.length} more —{" "}
              <Link href={href} className="font-semibold text-kuartz-ink underline">
                see all
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState className="mt-4" title="Clear" description={empty} />
      )}
    </div>
  );
}
