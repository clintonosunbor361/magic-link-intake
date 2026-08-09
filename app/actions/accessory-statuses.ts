"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAccessoryStatusRepository } from "@/lib/accessory-statuses/repository";
import {
  archiveAccessoryStatus,
  createAccessoryStatus,
  restoreAccessoryStatus,
  setAccessoryStatusCompleted,
} from "@/lib/accessory-statuses/service";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";

const SETTINGS_PATH = "/settings/accessory-statuses";

export async function createAccessoryStatusAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await createAccessoryStatus(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        name: readFormString(formData, "name"),
        sortOrder: Number(readFormString(formData, "sortOrder")),
        isCompleted: formData.get("isCompleted") === "on",
      },
      createAccessoryStatusRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory status could not be created.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function archiveAccessoryStatusAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await archiveAccessoryStatus(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        statusId: readFormString(formData, "statusId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryStatusRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory status could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function restoreAccessoryStatusAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await restoreAccessoryStatus(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        statusId: readFormString(formData, "statusId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryStatusRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory status could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function setAccessoryStatusCompletedAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await setAccessoryStatusCompleted(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        statusId: readFormString(formData, "statusId"),
        isCompleted: readFormString(formData, "isCompleted") === "true",
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryStatusRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory status could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}
