"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createLeadSourceRepository } from "@/lib/lead-sources/repository";
import { archiveLeadSource, createLeadSource, restoreLeadSource } from "@/lib/lead-sources/service";

const SETTINGS_PATH = "/settings/lead-sources";

export async function createLeadSourceAction(formData: FormData) {
  const session = await requireStaffSession();
  const name = readFormString(formData, "name");
  const sortOrder = Number(readFormString(formData, "sortOrder"));

  try {
    await createLeadSource(
      { actor: { role: session.role }, organizationId: session.organizationId, name, sortOrder },
      createLeadSourceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Lead Source could not be created.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/clients/new");
  redirect(SETTINGS_PATH);
}

export async function archiveLeadSourceAction(formData: FormData) {
  const session = await requireStaffSession();
  const leadSourceId = readFormString(formData, "leadSourceId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveLeadSource(
      { actor: { role: session.role }, organizationId: session.organizationId, leadSourceId, expectedVersion },
      createLeadSourceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Lead Source could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/clients/new");
  redirect(SETTINGS_PATH);
}

export async function restoreLeadSourceAction(formData: FormData) {
  const session = await requireStaffSession();
  const leadSourceId = readFormString(formData, "leadSourceId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreLeadSource(
      { actor: { role: session.role }, organizationId: session.organizationId, leadSourceId, expectedVersion },
      createLeadSourceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Lead Source could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/clients/new");
  redirect(SETTINGS_PATH);
}
