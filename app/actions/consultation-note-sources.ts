"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { createConsultationNoteSourceRepository } from "@/lib/consultation-note-sources/repository";
import {
  archiveConsultationNoteSource,
  createConsultationNoteSource,
  restoreConsultationNoteSource,
} from "@/lib/consultation-note-sources/service";
import { readFormString } from "@/lib/forms/read-string";

export async function createConsultationNoteSourceAction(formData: FormData) {
  const session = await requireStaffSession();
  const name = readFormString(formData, "name");
  const sortOrder = Number(readFormString(formData, "sortOrder"));

  try {
    await createConsultationNoteSource(
      { actor: { role: session.role }, organizationId: session.organizationId, name, sortOrder },
      createConsultationNoteSourceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Source could not be created.";
    redirect(`/settings/consultation-note-sources?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/consultation-note-sources");
  redirect("/settings/consultation-note-sources");
}

export async function archiveConsultationNoteSourceAction(formData: FormData) {
  const session = await requireStaffSession();
  const sourceId = readFormString(formData, "sourceId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveConsultationNoteSource(
      { actor: { role: session.role }, organizationId: session.organizationId, sourceId, expectedVersion },
      createConsultationNoteSourceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Source could not be updated.";
    redirect(`/settings/consultation-note-sources?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/consultation-note-sources");
  redirect("/settings/consultation-note-sources");
}

export async function restoreConsultationNoteSourceAction(formData: FormData) {
  const session = await requireStaffSession();
  const sourceId = readFormString(formData, "sourceId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreConsultationNoteSource(
      { actor: { role: session.role }, organizationId: session.organizationId, sourceId, expectedVersion },
      createConsultationNoteSourceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Source could not be updated.";
    redirect(`/settings/consultation-note-sources?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/consultation-note-sources");
  redirect("/settings/consultation-note-sources");
}
