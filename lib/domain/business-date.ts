// Business dates — production deadlines, urgency bands, and (from Milestone 8) notification
// windows — resolve in the organization's timezone rather than the viewer's. A deadline is a
// business fact that must read identically to everyone: the badge on screen, the SQL behind the
// "Overdue" filter, and the viewer-less cron that emails about it all call through here.
//
// Instants (created_at, magic-link expiry) are the opposite case: stored UTC, formatted in the
// viewer's locale at the boundary. Do not route those through this module.

export const DEFAULT_ORGANIZATION_TIMEZONE = "Africa/Lagos";

/** An ISO calendar day, `YYYY-MM-DD` — the same shape Postgres `date` columns round-trip as. */
export type BusinessDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Intl is the only thing in the platform that knows a zone's current offset including any DST
// rule, so we format the instant into the zone and read the parts back rather than doing
// arithmetic on the UTC value.
export function toBusinessDate(instant: Date, timeZone: string): BusinessDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parts;
}

export function businessToday(timeZone: string, now: Date = new Date()): BusinessDate {
  return toBusinessDate(now, timeZone);
}

/** Format a date-only business fact without allowing the viewer's timezone to shift the day. */
export function formatBusinessDate(value: BusinessDate, locale = "en-NG"): string {
  const [year, month, day] = assertBusinessDate(value).split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function assertBusinessDate(value: string): BusinessDate {
  if (!ISO_DATE.test(value)) throw new Error("A date is required in YYYY-MM-DD format.");
  return value;
}

/**
 * Whole days from `from` to `to`, positive when `to` is later. Both are calendar days with no time
 * component, so this is plain civil-date arithmetic — deliberately not a duration in milliseconds,
 * which would make the answer depend on DST transitions between the two dates.
 */
export function daysBetween(from: BusinessDate, to: BusinessDate): number {
  const start = Date.parse(`${assertBusinessDate(from)}T00:00:00Z`);
  const end = Date.parse(`${assertBusinessDate(to)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
