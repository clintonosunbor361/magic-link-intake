import { assertCanManageFittingSessions, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import {
  assertFittingTransitionAllowed,
  assertReschedulable,
  type FittingSessionStatus,
} from "@/lib/fittings/fitting";

// A Fitting Session is one appointment on an Order, optionally scoped to a Look. Rescheduling edits
// the same record so the appointment keeps its identity, its notes and its history; a repeat fitting
// is a new record. Every status move and every reschedule appends a history row, which is the only
// reason the previous date survives an in-place edit.

export type FittingSessionRecord = {
  id: string;
  orderId: string;
  status: FittingSessionStatus;
  scheduledAt: Date;
  version: number;
  archivedAt: Date | null;
};

export type FittingSessionRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  lookBelongsToOrder(organizationId: string, orderId: string, lookId: string): Promise<boolean>;
  createSession(input: {
    organizationId: string;
    orderId: string;
    lookId: string | null;
    scheduledAt: Date;
    location: string;
    actorStaffId: string;
  }): Promise<{ id: string }>;
  getSession(organizationId: string, sessionId: string): Promise<FittingSessionRecord | null>;
  rescheduleSession(input: {
    organizationId: string;
    sessionId: string;
    scheduledAt: Date;
    previousScheduledAt: Date;
    location: string;
    status: FittingSessionStatus;
    note: string | null;
    actorStaffId: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  changeStatus(input: {
    organizationId: string;
    sessionId: string;
    previousStatus: FittingSessionStatus;
    newStatus: FittingSessionStatus;
    scheduledAt: Date;
    note: string | null;
    actorStaffId: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  updateClientSummary(input: {
    organizationId: string;
    sessionId: string;
    clientSummary: string;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    sessionId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  addNote(input: {
    organizationId: string;
    sessionId: string;
    note: string;
    actorStaffId: string;
  }): Promise<{ id: string }>;
};

export async function scheduleFittingSession(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    orderId: string;
    lookId: string | null;
    scheduledAt: Date;
    location: string;
  },
  repository: FittingSessionRepository,
) {
  assertCanManageFittingSessions(input.actor.role);

  if (!(await repository.orderBelongsToOrganization(input.organizationId, input.orderId))) {
    throw new Error("Order was not found.");
  }
  if (input.lookId && !(await repository.lookBelongsToOrder(input.organizationId, input.orderId, input.lookId))) {
    throw new Error("Look was not found on this Order.");
  }

  // Repeat fittings are simply further sessions on the same Order — nothing here rejects a second
  // one, because trying a garment on twice is normal rather than an error.
  return repository.createSession({
    organizationId: input.organizationId,
    orderId: input.orderId,
    lookId: input.lookId,
    scheduledAt: input.scheduledAt,
    location: input.location.trim(),
    actorStaffId: input.actor.staffId,
  });
}

export async function rescheduleFittingSession(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    sessionId: string;
    scheduledAt: Date;
    location: string;
    note: string | null;
    expectedVersion: number;
  },
  repository: FittingSessionRepository,
) {
  assertCanManageFittingSessions(input.actor.role);

  let existing: FittingSessionRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      existing = await repository.getSession(input.organizationId, input.sessionId);
      return existing;
    },
    notFoundMessage: "Fitting was not found.",
    staleMessage: "This Fitting changed. Reload and try again.",
    persist: (nextVersion) => {
      const current = existing as FittingSessionRecord;
      if (current.archivedAt) throw new Error("An archived Fitting cannot be rescheduled.");
      assertReschedulable(current.status);

      return repository.rescheduleSession({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        scheduledAt: input.scheduledAt,
        previousScheduledAt: current.scheduledAt,
        location: input.location.trim(),
        status: current.status,
        note: input.note?.trim() || null,
        actorStaffId: input.actor.staffId,
        expectedVersion: input.expectedVersion,
        nextVersion,
      });
    },
  });
}

export async function changeFittingStatus(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    sessionId: string;
    newStatus: FittingSessionStatus;
    note: string | null;
    expectedVersion: number;
  },
  repository: FittingSessionRepository,
) {
  assertCanManageFittingSessions(input.actor.role);

  let existing: FittingSessionRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      existing = await repository.getSession(input.organizationId, input.sessionId);
      return existing;
    },
    notFoundMessage: "Fitting was not found.",
    staleMessage: "This Fitting changed. Reload and try again.",
    persist: (nextVersion) => {
      const current = existing as FittingSessionRecord;
      if (current.archivedAt) throw new Error("An archived Fitting cannot change status.");
      assertFittingTransitionAllowed(current.status, input.newStatus);

      return repository.changeStatus({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        previousStatus: current.status,
        newStatus: input.newStatus,
        scheduledAt: current.scheduledAt,
        note: input.note?.trim() || null,
        actorStaffId: input.actor.staffId,
        expectedVersion: input.expectedVersion,
        nextVersion,
      });
    },
  });
}

/**
 * The one field the client ever sees. Kept separate from the internal notes so that writing it is a
 * deliberate act rather than a side effect of jotting something down after the appointment.
 */
export async function updateFittingClientSummary(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    sessionId: string;
    clientSummary: string;
    expectedVersion: number;
  },
  repository: FittingSessionRepository,
) {
  assertCanManageFittingSessions(input.actor.role);

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getSession(input.organizationId, input.sessionId),
    notFoundMessage: "Fitting was not found.",
    staleMessage: "This Fitting changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateClientSummary({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        clientSummary: input.clientSummary.trim(),
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}

/**
 * Internal only. Alterations agreed at the fitting are recorded here in prose; none of this reaches
 * the client link or a Vendor Brief, the same rule production notes follow.
 */
export async function addFittingNote(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    sessionId: string;
    note: string;
  },
  repository: FittingSessionRepository,
) {
  assertCanManageFittingSessions(input.actor.role);
  const note = input.note.trim();
  if (!note) throw new Error("A note is required.");

  const session = await repository.getSession(input.organizationId, input.sessionId);
  if (!session) throw new Error("Fitting was not found.");

  return repository.addNote({
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    note,
    actorStaffId: input.actor.staffId,
  });
}

export async function archiveFittingSession(
  input: { actor: { role: StaffRole }; organizationId: string; sessionId: string; expectedVersion: number },
  repository: FittingSessionRepository,
) {
  if (!mayArchive("fitting_session", input.actor.role)) {
    throw new Error("You cannot archive this Fitting.");
  }
  return setArchivedState(input, true, repository);
}

export async function restoreFittingSession(
  input: { actor: { role: StaffRole }; organizationId: string; sessionId: string; expectedVersion: number },
  repository: FittingSessionRepository,
) {
  if (!mayRestore("fitting_session", input.actor.role)) {
    throw new Error("You cannot restore this Fitting.");
  }
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; sessionId: string; expectedVersion: number },
  archived: boolean,
  repository: FittingSessionRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getSession(input.organizationId, input.sessionId),
    notFoundMessage: "Fitting was not found.",
    staleMessage: "This Fitting changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
