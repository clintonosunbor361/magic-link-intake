// Fitting Session states, kept as a fixed set rather than a configurable list.
//
// Production and Accessory statuses are configurable because they are workflow labels the business
// tunes. These are not: the app reasons about every one of them. Reminders fire on `scheduled`,
// Order completion warns on anything still open, and `missed` has to stay distinguishable from
// `cancelled` — a client who did not turn up is a different fact from an appointment called off.

export const FITTING_SESSION_STATUSES = ["scheduled", "completed", "missed", "cancelled"] as const;
export type FittingSessionStatus = (typeof FITTING_SESSION_STATUSES)[number];

export const FITTING_STATUS_LABELS: Record<FittingSessionStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};

/** Terminal states no longer count as outstanding work on the Order. */
const TERMINAL: ReadonlySet<FittingSessionStatus> = new Set<FittingSessionStatus>([
  "completed",
  "missed",
  "cancelled",
]);

export function isTerminalFittingStatus(status: FittingSessionStatus): boolean {
  return TERMINAL.has(status);
}

export function isOpenFittingStatus(status: FittingSessionStatus): boolean {
  return !isTerminalFittingStatus(status);
}

/**
 * Only a scheduled session can move. Once a session is completed, missed or cancelled it is history:
 * correcting it means booking a repeat session, which is a new record, rather than reopening the
 * record a client may already have confirmed.
 */
export function assertFittingTransitionAllowed(
  current: FittingSessionStatus,
  next: FittingSessionStatus,
): void {
  if (current === next) throw new Error("This Fitting is already at that status.");
  if (isTerminalFittingStatus(current)) {
    throw new Error(
      `A ${FITTING_STATUS_LABELS[current].toLowerCase()} Fitting cannot change status. Schedule a repeat Fitting instead.`,
    );
  }
}

/**
 * Rescheduling is only meaningful while a session is still going to happen. Moving a missed session
 * would erase the fact that it was missed.
 */
export function assertReschedulable(current: FittingSessionStatus): void {
  if (isTerminalFittingStatus(current)) {
    throw new Error(
      `A ${FITTING_STATUS_LABELS[current].toLowerCase()} Fitting cannot be rescheduled. Schedule a repeat Fitting instead.`,
    );
  }
}

/**
 * The client link is only meaningful once the fitting has happened — it asks the client to confirm
 * the fit and the alterations agreed, not to accept an appointment.
 */
export function assertConfirmable(current: FittingSessionStatus, clientSummary: string): void {
  if (current !== "completed") {
    throw new Error("Mark this Fitting completed before asking the client to confirm the outcome.");
  }
  if (!clientSummary.trim()) {
    throw new Error("Write the client-facing summary before sending the confirmation link.");
  }
}

export function parseScheduledAt(raw: string): Date {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid fitting date and time.");
  return parsed;
}
