import { type BusinessDate, daysBetween } from "@/lib/domain/business-date";

// The reminder windows from the spec: 7, 3 and 1 days before a deadline, plus an overdue alert.
// Everything here is pure and takes `today` as an argument, so the cron, the tests and any future
// preview all answer the same question the same way, and tests state a date instead of mocking a
// clock.

export const NOTIFICATION_TRIGGERS = ["days_7", "days_3", "days_1", "overdue"] as const;
export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number];

/** Days before the deadline each lead-time trigger fires on. Overdue is handled separately. */
const LEAD_DAYS: Record<Exclude<NotificationTrigger, "overdue">, number> = {
  days_7: 7,
  days_3: 3,
  days_1: 1,
};

export const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  days_7: "Due in 7 days",
  days_3: "Due in 3 days",
  days_1: "Due tomorrow",
  overdue: "Overdue",
};

/**
 * The calendar day a given trigger fires on for a deadline. Overdue fires on the first day past the
 * deadline — once, not daily: the persistent "still overdue" state is what the dashboard and the
 * production workspace already show, so repeating the alert would restate what is on screen.
 */
export function triggerFireDate(dueDate: BusinessDate, trigger: NotificationTrigger): BusinessDate {
  const offset = trigger === "overdue" ? -1 : LEAD_DAYS[trigger];
  return shiftDays(dueDate, -offset);
}

/**
 * Every trigger for this deadline that should exist by `today` — including ones whose day has
 * already passed, so a cron outage or a first run still produces a complete dashboard record.
 * Whether each one may also be emailed is a separate question; see `mayEmail`.
 */
export function dueTriggers(input: { dueDate: BusinessDate; today: BusinessDate }): NotificationTrigger[] {
  return NOTIFICATION_TRIGGERS.filter(
    (trigger) => daysBetween(triggerFireDate(input.dueDate, trigger), input.today) >= 0,
  );
}

/**
 * Email is reserved for triggers landing today.
 *
 * A caught-up trigger — one whose day passed while the cron was down, or before this feature
 * existed — still gets its dashboard notification, but emailing it would mean the first deployment
 * blasting an entire backlog of overdue work into someone's inbox, and would re-announce deadlines
 * people have long since dealt with.
 */
export function mayEmail(input: {
  dueDate: BusinessDate;
  trigger: NotificationTrigger;
  today: BusinessDate;
}): boolean {
  return triggerFireDate(input.dueDate, input.trigger) === input.today;
}

export function shiftDays(date: BusinessDate, days: number): BusinessDate {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
