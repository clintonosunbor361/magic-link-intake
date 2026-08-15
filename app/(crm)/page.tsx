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
  listAwaitingClientResponses,
  listUpcomingFittings,
  listUpcomingLookDates,
} from "@/lib/dashboard/repository";
import { daysBetween } from "@/lib/domain/business-date";
import { countUnreadNotifications, listNotifications } from "@/lib/notifications/repository";
import { TRIGGER_LABELS } from "@/lib/notifications/triggers";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { listPendingRatingPrompts } from "@/lib/vendors/rating-repository";

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });
const timeFormatter = new Intl.DateTimeFormat("en-NG", { timeStyle: "short" });
const PANEL_LIMIT = 5;

type UpcomingLook = Awaited<ReturnType<typeof listUpcomingLookDates>>[number];
type UpcomingFitting = Awaited<ReturnType<typeof listUpcomingFittings>>[number];
type DelayedAssignment = Awaited<ReturnType<typeof listDelayedAssignments>>[number];
type FollowUp = Awaited<ReturnType<typeof listDueFollowUps>>[number];
type AwaitingResponse = Awaited<ReturnType<typeof listAwaitingClientResponses>>[number];
type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];
type RatingPrompt = Awaited<ReturnType<typeof listPendingRatingPrompts>>[number];

type PipelineRow = {
  label: string;
  value: number;
  href: string;
  hint: string;
};

type WorkRow = {
  key: string;
  href: string;
  label: string;
  title: string;
  meta: string;
  tone: "danger" | "approval" | "event";
};

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
    awaitingResponses,
    followUps,
    recentNotifications,
    unreadCount,
    pendingRatings,
  ] = await Promise.all([
    countActiveClients(session.organizationId),
    listUpcomingLookDates(session.organizationId, today),
    listUpcomingFittings(session.organizationId, now),
    listDelayedAssignments(session.organizationId, today),
    listAwaitingClientResponses(session.organizationId, now),
    listDueFollowUps(session.organizationId, today),
    listNotifications(session.organizationId, { unreadOnly: true, limit: PANEL_LIMIT }),
    countUnreadNotifications(session.organizationId),
    listPendingRatingPrompts(session.organizationId),
  ]);

  const firstName = session.fullName.split(" ")[0];
  const pipelineRows: PipelineRow[] = [
    { label: "Active clients", value: activeClients, href: "/clients", hint: "live orders" },
    { label: "Look dates", value: upcomingLooks.length, href: "/orders", hint: "next 60 days" },
    { label: "Fittings", value: upcomingFittings.length, href: "/orders", hint: "next 30 days" },
    { label: "Approvals", value: awaitingResponses.length, href: "/orders", hint: "client decisions" },
    { label: "Follow-ups", value: followUps.length, href: "/enquiries", hint: "due now" },
  ];
  const totalSignal = pipelineRows.reduce((sum, row) => sum + row.value, 0);
  const maxPipelineValue = Math.max(1, ...pipelineRows.map((row) => row.value));
  const workRows = buildWorkRows({ delayed, awaitingResponses, upcomingLooks, today });
  const nextLook = upcomingLooks[0];

  return (
    <div className="space-y-5">
      <header className="grid gap-5 rounded-[1.45rem] border border-white/85 bg-white/78 p-5 shadow-[0_24px_70px_rgba(21,22,63,0.08)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto] md:items-end sm:p-6">
        <div>
          <p className="eyebrow">
            <WeekdayLabel />
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-kuartz-ink sm:text-4xl">
            <Greeting name={firstName} />
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-kuartz-secondary">
            Everything due, late, or waiting on someone across {session.organizationName}.
          </p>
        </div>
        <NotificationCta unreadCount={unreadCount} />
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(18rem,1fr)]" aria-label="Operations snapshot">
        <PipelineCard rows={pipelineRows} totalSignal={totalSignal} maxValue={maxPipelineValue} />
        <TodayCard fittings={upcomingFittings} looks={upcomingLooks} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(16rem,0.78fr)_minmax(0,1.35fr)_minmax(17rem,0.78fr)]" aria-label="Priority work">
        <SpotlightCard followUp={followUps[0]} awaitingResponse={awaitingResponses[0]} />
        <WorkInMotionCard rows={workRows} delayedCount={delayed.length} />
        <FollowUpsCard followUps={followUps} today={today} />
      </section>

      <NextLookCard look={nextLook} fittings={upcomingFittings} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]" aria-label="Inbox and approvals">
        <NotificationsPanel notifications={recentNotifications} />
        <div className="grid gap-5">
          <ApprovalsPanel responses={awaitingResponses} />
          <RatingsPanel prompts={pendingRatings} />
        </div>
      </section>
    </div>
  );
}

function NotificationCta({ unreadCount }: { unreadCount: number }) {
  if (!unreadCount) {
    return (
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-kuartz-line bg-white/70 px-4 py-2 text-xs font-semibold text-kuartz-secondary">
        <span className="h-2 w-2 rounded-full bg-kuartz-lime" />
        Nothing unread
      </span>
    );
  }

  return (
    <Link
      href="/notifications"
      className="inline-flex w-fit items-center gap-2 rounded-full border border-kuartz-ink bg-kuartz-ink px-4 py-2 text-xs font-semibold text-white transition duration-200 hover:-translate-y-px hover:bg-kuartz-navy"
    >
      {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
      <ArrowRight size={14} />
    </Link>
  );
}

function PipelineCard({
  rows,
  totalSignal,
  maxValue,
}: {
  rows: PipelineRow[];
  totalSignal: number;
  maxValue: number;
}) {
  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kuartz-muted">Pipeline</p>
          <p className="mt-2 text-4xl font-extrabold text-kuartz-ink">{totalSignal}</p>
          <p className="text-sm text-kuartz-secondary">active signals</p>
        </div>
        <Link href="/orders" className="text-xs font-extrabold text-kuartz-ink underline-offset-4 hover:underline">
          View orders
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <Link key={row.label} href={row.href} className="group block">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-kuartz-secondary group-hover:text-kuartz-ink">{row.label}</span>
              <span className="font-extrabold text-kuartz-ink">{row.value}</span>
            </div>
            <ProgressBar value={row.value} max={maxValue} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function TodayCard({ fittings, looks }: { fittings: UpcomingFitting[]; looks: UpcomingLook[] }) {
  const fittingRows = fittings.slice(0, 4);
  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kuartz-muted">Today and next</p>
          <h2 className="mt-2 text-lg font-extrabold text-kuartz-ink">Fittings</h2>
        </div>
        <span className="rounded-full border border-kuartz-line bg-white px-2.5 py-1 text-xs font-extrabold text-kuartz-secondary">
          {fittings.length}
        </span>
      </div>

      {fittingRows.length ? (
        <ol className="mt-5 space-y-4">
          {fittingRows.map((row) => (
            <li key={row.id} className="grid grid-cols-[4.6rem_minmax(0,1fr)] gap-3 text-sm">
              <time className="font-extrabold text-kuartz-ink" dateTime={row.scheduledAt.toISOString()}>{timeFormatter.format(row.scheduledAt)}</time>
              <div className="min-w-0">
                <Link href={`/orders/${row.orderId}/fittings`} className="block truncate font-semibold text-kuartz-ink hover:underline">
                  {row.lookName ? `${row.lookName} fitting` : "Fitting"}
                </Link>
                <p className="mt-0.5 truncate text-xs text-kuartz-muted">{row.clientName} - {row.orderTitle}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-[1rem] border border-dashed border-kuartz-line bg-white/65 px-4 py-5 text-sm text-kuartz-muted">
          No fittings scheduled soon. {looks.length ? `${looks.length} Look date${looks.length === 1 ? "" : "s"} ahead.` : "No upcoming Look dates."}
        </p>
      )}
    </section>
  );
}

function SpotlightCard({
  followUp,
  awaitingResponse,
}: {
  followUp?: FollowUp;
  awaitingResponse?: AwaitingResponse;
}) {
  if (!followUp && !awaitingResponse) {
    return (
      <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kuartz-muted">Spotlight</p>
        <EmptyState className="mt-4 rounded-[1rem] border border-dashed border-kuartz-line py-8" title="Clear" description="No client item needs a spotlight right now." />
      </section>
    );
  }

  if (followUp) {
    return (
      <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kuartz-muted">Follow-up spotlight</p>
          <span className="rounded-full bg-kuartz-lime px-2.5 py-1 text-[0.68rem] font-extrabold text-kuartz-ink">Due</span>
        </div>
        <h2 className="mt-5 text-lg font-extrabold text-kuartz-ink">{followUp.enquiryName}</h2>
        <p className="mt-1 text-sm text-kuartz-muted">{followUp.assigneeName}</p>
        <p className="mt-5 rounded-[1rem] border border-kuartz-line bg-white/72 p-4 text-sm leading-6 text-kuartz-secondary">
          {followUp.title}
        </p>
        <Link href={`/enquiries/${followUp.enquiryId}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-kuartz-ink px-4 text-sm font-extrabold text-white transition hover:-translate-y-px hover:bg-kuartz-navy">
          Open enquiry <ArrowRight size={14} />
        </Link>
      </section>
    );
  }

  if (!awaitingResponse) {
    return null;
  }

  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kuartz-muted">Approval spotlight</p>
      <h2 className="mt-5 text-lg font-extrabold text-kuartz-ink">{awaitingResponse.clientName}</h2>
      <p className="mt-1 text-sm text-kuartz-muted">{awaitingResponse.label}</p>
      <p className="mt-5 rounded-[1rem] border border-kuartz-line bg-white/72 p-4 text-sm leading-6 text-kuartz-secondary">
        {awaitingResponse.type} requested {dateFormatter.format(awaitingResponse.createdAt)} is still waiting on the client.
      </p>
      <Link href={awaitingResponse.href} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-kuartz-ink px-4 text-sm font-extrabold text-white transition hover:-translate-y-px hover:bg-kuartz-navy">
        Open work <ArrowRight size={14} />
      </Link>
    </section>
  );
}

function WorkInMotionCard({ rows, delayedCount }: { rows: WorkRow[]; delayedCount: number }) {
  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-kuartz-muted">Work in motion</p>
          <h2 className="mt-2 text-xl font-extrabold text-kuartz-ink">Production and decisions</h2>
        </div>
        <Link href="/production" className="text-xs font-extrabold text-kuartz-ink underline-offset-4 hover:underline">
          All production
        </Link>
      </div>

      {rows.length ? (
        <div className="mt-5 space-y-5">
          {rows.map((row) => (
            <Link key={row.key} href={row.href} className="group grid gap-3 rounded-[1rem] border border-kuartz-line bg-white/58 p-4 transition hover:border-kuartz-ink md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.44fr)] md:items-center">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-kuartz-muted">{row.label}</p>
                <p className="mt-1 truncate font-extrabold text-kuartz-ink group-hover:underline">{row.title}</p>
                <p className="mt-1 text-sm text-kuartz-secondary">{row.meta}</p>
              </div>
              <SegmentedPulse tone={row.tone} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState className="mt-5 rounded-[1rem] border border-dashed border-kuartz-line py-10" title="No moving work" description="No production, approval, or event item needs attention." />
      )}

      <p className="mt-5 text-sm text-kuartz-muted">
        {delayedCount ? `${delayedCount} assignment${delayedCount === 1 ? "" : "s"} behind schedule.` : "Production deadlines are clear."}
      </p>
    </section>
  );
}

function FollowUpsCard({ followUps, today }: { followUps: FollowUp[]; today: string }) {
  return (
    <section className="rounded-[1.45rem] bg-[#151a2f] p-5 text-white shadow-[0_28px_80px_rgba(21,22,63,0.22)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/58">Follow-ups</p>
          <h2 className="mt-2 text-xl font-extrabold">Due now</h2>
        </div>
        <span className="rounded-full bg-kuartz-lime px-2.5 py-1 text-[0.68rem] font-extrabold text-kuartz-ink">
          {followUps.length} open
        </span>
      </div>

      {followUps.length ? (
        <ol className="mt-5 space-y-3">
          {followUps.slice(0, 5).map((row) => {
            const days = daysBetween(today, row.dueDate);
            return (
              <li key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[0.9rem] border border-white/10 bg-white/[0.04] p-3">
                <span className="mt-1 h-3 w-3 rounded-sm border border-white/30" aria-hidden="true" />
                <div className="min-w-0">
                  <Link href={`/enquiries/${row.enquiryId}`} className="block truncate text-sm font-semibold text-white hover:underline">
                    {row.title}
                  </Link>
                  <p className="mt-1 text-xs text-white/56">{row.enquiryName} - {countdownLabel(days)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-5 rounded-[1rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/62">
          Nothing overdue or due today.
        </p>
      )}
    </section>
  );
}

function NextLookCard({ look, fittings }: { look?: UpcomingLook; fittings: UpcomingFitting[] }) {
  const fitting = fittings[0];
  if (!look && !fitting) {
    return (
      <section className="rounded-[1.45rem] border border-white/85 bg-white/86 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl sm:p-6">
        <EmptyState title="Calendar clear" description="No upcoming Look dates or fittings are scheduled in the current window." />
      </section>
    );
  }

  const href = look ? `/orders/${look.orderId}` : `/orders/${fitting?.orderId}/fittings`;
  const title = look ? `${look.orderTitle} - ${look.lookName}` : fitting?.orderTitle ?? "Upcoming fitting";
  const client = look ? look.clientName : fitting?.clientName;
  const detail = look?.lookDate
    ? `Look date ${dateFormatter.format(new Date(`${look.lookDate}T00:00:00`))}`
    : fitting
      ? `Fitting ${dateTimeFormatter.format(fitting.scheduledAt)}`
      : "Upcoming work";

  return (
    <section className="grid overflow-hidden rounded-[1.45rem] border border-white/85 bg-white/86 shadow-[0_22px_65px_rgba(21,22,63,0.08)] backdrop-blur-xl md:grid-cols-[minmax(14rem,0.52fr)_minmax(0,1fr)_auto] md:items-stretch">
      <div className="relative min-h-44 bg-kuartz-ink p-5 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(210,255,103,0.26),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent_55%)]" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between">
          <span className="w-fit rounded-full bg-white/12 px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white/76">
            Next client moment
          </span>
          <div className="mt-10 grid grid-cols-4 items-end gap-2" aria-hidden="true">
            {[38, 68, 52, 88].map((height, index) => (
              <span key={height} className={`rounded-t-[0.8rem] ${index === 3 ? "bg-kuartz-lime" : "bg-white/24"}`} style={{ height: `${height}px` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-sm font-extrabold text-kuartz-ink">{title}</p>
        <p className="mt-2 text-sm text-kuartz-secondary">{client}</p>
        <p className="mt-4 text-sm text-kuartz-muted">{detail}</p>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:p-6 md:min-w-52 md:justify-center">
        <Link href={href} className="inline-flex min-h-11 items-center justify-center rounded-full bg-kuartz-ink px-5 text-sm font-extrabold text-white transition hover:-translate-y-px hover:bg-kuartz-navy">
          Open work
        </Link>
        <Link href="/orders" className="inline-flex min-h-11 items-center justify-center rounded-full border border-kuartz-line bg-white px-5 text-sm font-extrabold text-kuartz-ink transition hover:border-kuartz-ink">
          View orders
        </Link>
      </div>
    </section>
  );
}

function NotificationsPanel({ notifications }: { notifications: NotificationRow[] }) {
  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/78 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.07)] backdrop-blur-xl sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="section-title">Notifications</h2>
        <Link href="/notifications" className="text-sm font-semibold text-kuartz-ink underline">All</Link>
      </div>
      {notifications.length ? (
        <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
          {notifications.map((row) => (
            <li key={row.id} className="py-3">
              <p className="text-sm font-semibold text-kuartz-ink">
                <Link href={row.href} className="underline-offset-4 hover:underline">{row.title}</Link>
              </p>
              <p className="mt-1 text-xs text-kuartz-muted">{TRIGGER_LABELS[row.trigger]} - {row.dueDate}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 border-y border-kuartz-line py-5 text-sm text-kuartz-muted">Nothing unread.</p>
      )}
    </section>
  );
}

function ApprovalsPanel({ responses }: { responses: AwaitingResponse[] }) {
  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/78 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.07)] backdrop-blur-xl sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="section-title">Awaiting client response</h2>
        <Link href="/orders" className="text-sm font-semibold text-kuartz-ink underline">Orders</Link>
      </div>
      {responses.length ? (
        <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
          {responses.slice(0, PANEL_LIMIT).map((row) => (
            <li key={row.key} className="py-3">
              <p className="text-sm font-semibold text-kuartz-ink">
                <Link href={row.href} className="underline-offset-4 hover:underline">{row.label}</Link>
              </p>
              <p className="mt-1 text-xs text-kuartz-muted">{row.type} - {row.clientName} - requested {dateFormatter.format(row.createdAt)}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 border-y border-kuartz-line py-5 text-sm text-kuartz-muted">Nothing awaiting a client decision.</p>
      )}
    </section>
  );
}

function RatingsPanel({ prompts }: { prompts: RatingPrompt[] }) {
  return (
    <section className="rounded-[1.45rem] border border-white/85 bg-white/78 p-5 shadow-[0_22px_65px_rgba(21,22,63,0.07)] backdrop-blur-xl sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="section-title">Vendor ratings to finish</h2>
        <Link href="/vendor-ratings" className="text-sm font-semibold text-kuartz-ink underline">Ratings</Link>
      </div>
      {prompts.length ? (
        <ol className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
          {prompts.slice(0, PANEL_LIMIT).map((row) => (
            <li key={`${row.orderId}-${row.vendorId}`} className="py-3">
              <p className="text-sm font-semibold text-kuartz-ink">
                <Link href={`/orders/${row.orderId}/vendor-ratings`} className="underline-offset-4 hover:underline">{row.vendorName}</Link>
              </p>
              <p className="mt-1 text-xs text-kuartz-muted">{row.clientName} - {row.orderTitle}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 border-y border-kuartz-line py-5 text-sm text-kuartz-muted">No completed Vendor work is waiting for a rating.</p>
      )}
    </section>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const width = value > 0 && max > 0 ? Math.max(7, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-kuartz-lineSoft">
      <div className="h-full rounded-full bg-kuartz-ink" style={{ width: `${width}%` }} />
    </div>
  );
}

function SegmentedPulse({ tone }: { tone: WorkRow["tone"] }) {
  const activeClass = tone === "danger" ? "bg-[#c35a3d]" : tone === "approval" ? "bg-kuartz-ink" : "bg-kuartz-lime";
  const activeCount = tone === "danger" ? 2 : tone === "approval" ? 3 : 4;
  return (
    <div className="grid grid-cols-4 gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <span key={index} className={`h-2 rounded-full ${index < activeCount ? activeClass : "bg-kuartz-lineSoft"}`} />
      ))}
    </div>
  );
}

function buildWorkRows({
  delayed,
  awaitingResponses,
  upcomingLooks,
  today,
}: {
  delayed: DelayedAssignment[];
  awaitingResponses: AwaitingResponse[];
  upcomingLooks: UpcomingLook[];
  today: string;
}): WorkRow[] {
  const delayedRows: WorkRow[] = delayed.slice(0, 2).map((row) => ({
    key: `delayed-${row.assignmentId}`,
    href: `/production/${row.assignmentId}`,
    label: "Behind schedule",
    title: row.itemLabel ?? row.itemTypeName,
    meta: `${row.vendorName} - ${row.clientName} - overdue by ${Math.abs(daysBetween(today, row.deadline))}d`,
    tone: "danger",
  }));

  const approvalRows: WorkRow[] = awaitingResponses.slice(0, 2).map((row) => ({
    key: `approval-${row.key}`,
    href: row.href,
    label: "Client decision",
    title: row.label,
    meta: `${row.clientName} - ${row.type} requested ${dateFormatter.format(row.createdAt)}`,
    tone: "approval",
  }));

  const eventRows: WorkRow[] = upcomingLooks.slice(0, 2).map((row) => ({
    key: `event-${row.lookId}`,
    href: `/orders/${row.orderId}`,
    label: "Upcoming look",
    title: `${row.orderTitle} - ${row.lookName}`,
    meta: row.lookDate ? `${row.clientName} - ${countdownLabel(daysBetween(today, row.lookDate))}` : row.clientName,
    tone: "event",
  }));

  return [...delayedRows, ...approvalRows, ...eventRows].slice(0, PANEL_LIMIT);
}

function countdownLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return "Today";
  if (daysRemaining === 1) return "Tomorrow";
  return `In ${daysRemaining}d`;
}
