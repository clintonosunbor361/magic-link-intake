import type { BusinessDate } from "@/lib/domain/business-date";
import { dueTriggers, mayEmail, type NotificationTrigger, TRIGGER_LABELS } from "@/lib/notifications/triggers";

// Turning deadlines into notifications, kept free of database and email concerns so the whole
// decision — which reminders exist, which may be emailed, and to whom — is unit-testable.

export const NOTIFICATION_SOURCE_TYPES = [
  "client_task",
  "vendor_assignment",
  "accessory_item",
  "fitting_session",
] as const;
export type NotificationSourceType = (typeof NOTIFICATION_SOURCE_TYPES)[number];

/** A deadline-bearing record, flattened to the few fields a reminder actually needs. */
export type DeadlineSource = {
  sourceType: NotificationSourceType;
  sourceId: string;
  dueDate: BusinessDate;
  subject: string;
  context: string;
  href: string;
  /** The person who can act. Only they are emailed; the dashboard shows everything to everyone. */
  recipientStaffId: string | null;
};

export type PlannedNotification = {
  sourceType: NotificationSourceType;
  sourceId: string;
  trigger: NotificationTrigger;
  dueDate: BusinessDate;
  recipientStaffId: string | null;
  title: string;
  body: string;
  href: string;
  emailEligible: boolean;
};

const SOURCE_LABELS: Record<NotificationSourceType, string> = {
  client_task: "To-do",
  vendor_assignment: "Production deadline",
  accessory_item: "Accessory",
  fitting_session: "Fitting",
};

/**
 * Expands one deadline into every reminder that should exist as of `today`.
 *
 * Triggers whose day has already passed are still planned — the dashboard record must be complete
 * after an outage — but only a trigger landing today is email-eligible.
 */
export function planNotificationsForSource(input: {
  source: DeadlineSource;
  today: BusinessDate;
}): PlannedNotification[] {
  const { source, today } = input;

  return dueTriggers({ dueDate: source.dueDate, today }).map((trigger) => ({
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    trigger,
    dueDate: source.dueDate,
    recipientStaffId: source.recipientStaffId,
    title: `${SOURCE_LABELS[source.sourceType]}: ${source.subject}`,
    body: buildBody({ trigger, dueDate: source.dueDate, context: source.context }),
    href: source.href,
    emailEligible: mayEmail({ dueDate: source.dueDate, trigger, today }),
  }));
}

export function planNotifications(input: {
  sources: readonly DeadlineSource[];
  today: BusinessDate;
}): PlannedNotification[] {
  return input.sources.flatMap((source) => planNotificationsForSource({ source, today: input.today }));
}

function buildBody(input: { trigger: NotificationTrigger; dueDate: BusinessDate; context: string }): string {
  const timing =
    input.trigger === "overdue"
      ? `was due ${input.dueDate}`
      : `${TRIGGER_LABELS[input.trigger].toLowerCase()} — ${input.dueDate}`;
  return input.context ? `${input.context} · ${timing}` : timing;
}

export type NotificationEmailOutcome =
  | { state: "sent" }
  | { state: "failed"; error: string }
  | { state: "skipped" };

/** A row this run actually created, carrying its key so email eligibility matches exactly. */
export type CreatedNotification = {
  id: string;
  sourceType: NotificationSourceType;
  sourceId: string;
  trigger: NotificationTrigger;
  dueDate: BusinessDate;
  recipientStaffId: string | null;
  title: string;
  body: string;
  href: string;
};

export function notificationKey(input: {
  sourceType: NotificationSourceType;
  sourceId: string;
  trigger: NotificationTrigger;
  dueDate: BusinessDate;
}): string {
  return `${input.sourceType}:${input.sourceId}:${input.trigger}:${input.dueDate}`;
}

export type NotificationRepository = {
  /**
   * Inserts the planned rows, ignoring any that already exist. The unique index on
   * (source_type, source_id, trigger, due_date) is what makes this idempotent, so a retried or
   * double-fired cron cannot produce duplicates. Returns only the rows this call actually created.
   */
  insertMissing(input: {
    organizationId: string;
    planned: readonly PlannedNotification[];
  }): Promise<CreatedNotification[]>;
  recordEmailOutcome(input: { notificationId: string; outcome: NotificationEmailOutcome }): Promise<void>;
  getStaffEmail(organizationId: string, staffId: string): Promise<{ email: string; fullName: string } | null>;
};

export type NotificationEmailSender = {
  sendDeadlineEmail(input: {
    to: string;
    staffName: string;
    title: string;
    body: string;
    url: string;
  }): Promise<void>;
};

/**
 * Creates the notifications and attempts the emails for those eligible.
 *
 * Insert and email are deliberately separate steps: the row is committed first, so an email failure
 * downgrades to a recorded `failed` state on an existing dashboard notification rather than losing
 * the notification altogether. One recipient's bounce never blocks anyone else's.
 */
export async function dispatchNotifications(
  input: {
    organizationId: string;
    planned: readonly PlannedNotification[];
    appOrigin: string;
  },
  repository: NotificationRepository,
  email: NotificationEmailSender,
): Promise<{ created: number; emailed: number; failed: number; skipped: number }> {
  const created = await repository.insertMissing({
    organizationId: input.organizationId,
    planned: input.planned,
  });

  // Only rows this run created are candidates: an existing row has already had its one email
  // attempt, and re-sending on every cron tick is exactly the duplication the unique index prevents.
  const emailEligible = new Set(
    input.planned.filter((plan) => plan.emailEligible).map((plan) => notificationKey(plan)),
  );

  let emailed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of created) {
    const eligible = emailEligible.has(notificationKey(row));

    if (!eligible || !row.recipientStaffId) {
      skipped += 1;
      await repository.recordEmailOutcome({ notificationId: row.id, outcome: { state: "skipped" } });
      continue;
    }

    const staff = await repository.getStaffEmail(input.organizationId, row.recipientStaffId);
    if (!staff) {
      skipped += 1;
      await repository.recordEmailOutcome({ notificationId: row.id, outcome: { state: "skipped" } });
      continue;
    }

    try {
      await email.sendDeadlineEmail({
        to: staff.email,
        staffName: staff.fullName,
        title: row.title,
        body: row.body,
        url: `${input.appOrigin}${row.href}`,
      });
      emailed += 1;
      await repository.recordEmailOutcome({ notificationId: row.id, outcome: { state: "sent" } });
    } catch (error) {
      // The dashboard notification survives; only its email state changes, and the error is kept so
      // a failure is diagnosable rather than silent.
      failed += 1;
      await repository.recordEmailOutcome({
        notificationId: row.id,
        outcome: { state: "failed", error: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  }

  return { created: created.length, emailed, failed, skipped };
}
