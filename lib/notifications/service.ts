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

export type NotificationEmailPayload = {
  to: string; staffName: string; title: string; body: string; url: string;
};
export type NotificationEmailOutcome =
  | { state: "sent" }
  | { state: "failed"; error: string; retrySafe: boolean }
  | { state: "skipped" };

export type CreatedNotification = Omit<PlannedNotification, "emailEligible"> & { id: string };
export type EmailCandidate = CreatedNotification & {
  emailAttempts: number;
  emailFirstAttemptAt: Date | null;
  emailRetrySafe: boolean;
  emailPayload: NotificationEmailPayload | null;
};

export const MAX_EMAIL_ATTEMPTS = 5;
export const EMAIL_BATCH_SIZE = 25;
// Resend retains idempotency keys for 24 hours. Leave a margin for clocks/network latency.
export const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;

export class NotificationDeliveryError extends Error {
  constructor(message: string, readonly retrySafe: boolean) { super(message); }
}

export function notificationKey(input: Pick<PlannedNotification, "sourceType" | "sourceId" | "trigger" | "dueDate">): string {
  return `${input.sourceType}:${input.sourceId}:${input.trigger}:${input.dueDate}`;
}

/** Unknown outcomes must not be retried after the provider's deduplication window. */
export function canRetryEmail(row: Pick<EmailCandidate, "emailAttempts" | "emailRetrySafe" | "emailFirstAttemptAt">, now: Date): boolean {
  if (row.emailAttempts >= MAX_EMAIL_ATTEMPTS) return false;
  return row.emailAttempts === 0 || row.emailRetrySafe ||
    (row.emailFirstAttemptAt !== null && now.getTime() - row.emailFirstAttemptAt.getTime() < IDEMPOTENCY_WINDOW_MS);
}

export type NotificationRepository = {
  insertMissing(input: { organizationId: string; planned: readonly PlannedNotification[] }): Promise<CreatedNotification[]>;
  listEmailCandidates(organizationId: string): Promise<EmailCandidate[]>;
  // A compare-and-set lease prevents concurrent cron invocations claiming the same email.
  claimEmail(input: { organizationId: string; notificationId: string; expectedAttempts: number; payload: NotificationEmailPayload; now: Date }): Promise<{ claimId: string; payload: NotificationEmailPayload } | null>;
  recordEmailOutcome(input: { organizationId: string; notificationId: string; claimId: string; outcome: NotificationEmailOutcome }): Promise<void>;
  getStaffEmail(organizationId: string, staffId: string): Promise<{ email: string; fullName: string } | null>;
};

export type NotificationEmailSender = {
  sendDeadlineEmail(input: NotificationEmailPayload & { idempotencyKey: string }): Promise<unknown>;
};

/** Durable dashboard records and separately leased email attempts; successful emails never retry. */
export async function dispatchNotifications(
  input: { organizationId: string; planned: readonly PlannedNotification[]; appOrigin: string; now?: Date },
  repository: NotificationRepository,
  email: NotificationEmailSender,
): Promise<{ created: number; emailed: number; failed: number; skipped: number }> {
  const now = input.now ?? new Date();
  const created = await repository.insertMissing({ organizationId: input.organizationId, planned: input.planned });
  const plans = new Map(input.planned.map((plan) => [notificationKey(plan), plan]));
  const candidates = await repository.listEmailCandidates(input.organizationId);
  let emailed = 0, failed = 0;
  let skipped = created.filter((row) => !plans.get(notificationKey(row))?.emailEligible || !row.recipientStaffId).length;

  for (const row of candidates) {
    const plan = plans.get(notificationKey(row));
    const staff = row.recipientStaffId ? await repository.getStaffEmail(input.organizationId, row.recipientStaffId) : null;
    // Stop stale/rescheduled/completed work and revoked recipients, including old failed emails.
    const obsolete = !plan || plan.recipientStaffId !== row.recipientStaffId || !staff ||
      (row.emailPayload !== null && row.emailPayload.to !== staff.email) ||
      (row.emailAttempts === 0 && !row.emailRetrySafe && !plan.emailEligible);
    if (!obsolete && !canRetryEmail(row, now)) continue;

    const payload = row.emailPayload ?? {
      to: staff?.email ?? "", staffName: staff?.fullName ?? "",
      title: row.title, body: row.body, url: `${input.appOrigin}${row.href}`,
    };
    const claim = await repository.claimEmail({
      organizationId: input.organizationId, notificationId: row.id,
      expectedAttempts: row.emailAttempts, payload, now,
    });
    if (!claim) continue;
    const outcomeContext = { organizationId: input.organizationId, notificationId: row.id, claimId: claim.claimId };
    if (obsolete) {
      skipped += 1;
      await repository.recordEmailOutcome({ ...outcomeContext, outcome: { state: "skipped" } });
      continue;
    }

    let outcome: NotificationEmailOutcome;
    try {
      await email.sendDeadlineEmail({ ...claim.payload, idempotencyKey: `notification/${row.id}` });
      outcome = { state: "sent" };
      emailed += 1;
    } catch (error) {
      failed += 1;
      outcome = { state: "failed", error: error instanceof Error ? error.message : "Unknown delivery error",
        retrySafe: (row.emailAttempts === 0 || row.emailRetrySafe) && error instanceof NotificationDeliveryError && error.retrySafe };
    }
    // A failed DB acknowledgement must not be mislabeled as a provider rejection.
    // Leave the lease in place: recovery will reuse the same provider key and payload.
    await repository.recordEmailOutcome({ ...outcomeContext, outcome });
  }
  return { created: created.length, emailed, failed, skipped };
}
