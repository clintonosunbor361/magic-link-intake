"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { createFittingSessionRepository, getFittingSessionDetail } from "@/lib/fittings/repository";
import {
  addFittingNote,
  archiveFittingSession,
  changeFittingStatus,
  rescheduleFittingSession,
  restoreFittingSession,
  scheduleFittingSession,
  updateFittingClientSummary,
} from "@/lib/fittings/service";
import {
  assertConfirmable,
  FITTING_SESSION_STATUSES,
  parseScheduledAt,
  type FittingSessionStatus,
} from "@/lib/fittings/fitting";
import { issueConfirmation } from "@/lib/client-confirmations/service";
import { createClientConfirmationRepository } from "@/lib/client-confirmations/repository";
import { readFormString } from "@/lib/forms/read-string";

function fittingsPath(orderId: string): string {
  return `/orders/${orderId}/fittings`;
}

function readStatus(formData: FormData): FittingSessionStatus {
  const candidate = readFormString(formData, "newStatus");
  if (!FITTING_SESSION_STATUSES.includes(candidate as FittingSessionStatus)) {
    throw new Error("Select a valid fitting status.");
  }
  return candidate as FittingSessionStatus;
}

export async function scheduleFittingAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await scheduleFittingSession(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        orderId,
        lookId: readFormString(formData, "lookId") || null,
        scheduledAt: parseScheduledAt(readFormString(formData, "scheduledAt")),
        location: readFormString(formData, "location"),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Fitting could not be scheduled.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(fittingsPath(orderId));
}

export async function rescheduleFittingAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await rescheduleFittingSession(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        sessionId: readFormString(formData, "sessionId"),
        scheduledAt: parseScheduledAt(readFormString(formData, "scheduledAt")),
        location: readFormString(formData, "location"),
        note: readFormString(formData, "note") || null,
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Fitting could not be rescheduled.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(fittingsPath(orderId));
}

export async function changeFittingStatusAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await changeFittingStatus(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        sessionId: readFormString(formData, "sessionId"),
        newStatus: readStatus(formData),
        note: readFormString(formData, "note") || null,
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Fitting could not be updated.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(fittingsPath(orderId));
}

export async function updateFittingSummaryAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await updateFittingClientSummary(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        sessionId: readFormString(formData, "sessionId"),
        clientSummary: readFormString(formData, "clientSummary"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The summary could not be saved.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  redirect(fittingsPath(orderId));
}

export async function addFittingNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await addFittingNote(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        sessionId: readFormString(formData, "sessionId"),
        note: readFormString(formData, "note"),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The note could not be added.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  redirect(fittingsPath(orderId));
}

export async function archiveFittingAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await archiveFittingSession(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        sessionId: readFormString(formData, "sessionId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Fitting could not be updated.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(fittingsPath(orderId));
}

export async function restoreFittingAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await restoreFittingSession(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        sessionId: readFormString(formData, "sessionId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createFittingSessionRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Fitting could not be updated.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(fittingsPath(orderId));
}

/**
 * Issues the outcome-confirmation link. Guarded by assertConfirmable: the fitting must have happened
 * and must have a client-facing summary, because the link asks the client to confirm that summary.
 */
export async function issueFittingConfirmationAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const sessionId = readFormString(formData, "sessionId");

  let confirmationId: string;
  let token: string;
  try {
    const fitting = await getFittingSessionDetail(session.organizationId, sessionId);
    if (!fitting) throw new Error("Fitting was not found.");
    assertConfirmable(fitting.status, fitting.clientSummary);

    const issued = await issueConfirmation(
      {
        actor: { organizationId: session.organizationId, staffId: session.userId },
        subjectType: "fitting_session",
        subjectId: sessionId,
      },
      createClientConfirmationRepository(),
    );
    confirmationId = issued.confirmationId;
    token = issued.token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The confirmation link could not be created.";
    redirect(`${fittingsPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(fittingsPath(orderId));
  // The raw token is shown once on the created page and never stored — only its hash is.
  redirect(`/orders/${orderId}/fittings/${confirmationId}/created?token=${encodeURIComponent(token)}`);
}
