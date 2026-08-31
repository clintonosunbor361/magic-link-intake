"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { safeReturnPath, withReturnError } from "@/lib/forms/return-path";
import { createConsultationNoteRepository } from "@/lib/consultation-notes/repository";
import {
  archiveConsultationNote,
  createConsultationNote,
  restoreConsultationNote,
  updateConsultationNoteWithHistory,
} from "@/lib/consultation-notes/service";

// The "occurredAt" field is a <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm", no
// timezone). We render it from a Date via toISOString().slice(0, 16) (UTC digits), so we parse
// it back as UTC here too — otherwise the round-trip would silently drift by the server's offset.
function readOccurredAt(formData: FormData): Date | null {
  const raw = readFormString(formData, "occurredAt");
  return raw ? new Date(`${raw}:00Z`) : null;
}

export async function createConsultationNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId") || null;
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await createConsultationNote(
      {
        organizationId: session.organizationId,
        orderId,
        lookId,
        createdByStaffId: session.userId,
        fields: {
          sourceId: readFormString(formData, "sourceId"),
          body: readFormString(formData, "body"),
          occurredAt: readOccurredAt(formData),
        },
      },
      createConsultationNoteRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Consultation Note could not be created.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function updateConsultationNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const noteId = readFormString(formData, "noteId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await updateConsultationNoteWithHistory(
      {
        organizationId: session.organizationId,
        noteId,
        expectedVersion,
        editedByStaffId: session.userId,
        fields: {
          sourceId: readFormString(formData, "sourceId"),
          body: readFormString(formData, "body"),
          occurredAt: readOccurredAt(formData),
        },
      },
      createConsultationNoteRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Consultation Note could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function archiveConsultationNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const noteId = readFormString(formData, "noteId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await archiveConsultationNote(
      { actor: { organizationId: session.organizationId, role: session.role }, noteId, expectedVersion },
      createConsultationNoteRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Consultation Note could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function restoreConsultationNoteAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const noteId = readFormString(formData, "noteId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await restoreConsultationNote(
      { actor: { organizationId: session.organizationId, role: session.role }, noteId, expectedVersion },
      createConsultationNoteRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Consultation Note could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}
