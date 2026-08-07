"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createProductionStatusRepository } from "@/lib/production-statuses/repository";
import {
  archiveProductionStatus,
  createProductionStatus,
  restoreProductionStatus,
  setProductionStatusCompletedSemantics,
} from "@/lib/production-statuses/service";

const SETTINGS_PATH = "/settings/production-statuses";

export async function createProductionStatusAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await createProductionStatus(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        name: readFormString(formData, "name"),
        sortOrder: Number(readFormString(formData, "sortOrder")),
        isCompleted: formData.get("isCompleted") === "on",
      },
      createProductionStatusRepository(),
    );
  } catch (error) {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message(error, "The status could not be created."))}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function archiveProductionStatusAction(formData: FormData) {
  await setArchivedState(formData, true);
}

export async function restoreProductionStatusAction(formData: FormData) {
  await setArchivedState(formData, false);
}

async function setArchivedState(formData: FormData, archived: boolean) {
  const session = await requireStaffSession();
  const input = {
    actor: { role: session.role },
    organizationId: session.organizationId,
    statusId: readFormString(formData, "statusId"),
    expectedVersion: Number(readFormString(formData, "version")),
  };

  try {
    await (archived ? archiveProductionStatus : restoreProductionStatus)(input, createProductionStatusRepository());
  } catch (error) {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message(error, "The status could not be updated."))}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function setProductionStatusCompletedAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await setProductionStatusCompletedSemantics(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        statusId: readFormString(formData, "statusId"),
        isCompleted: readFormString(formData, "isCompleted") === "true",
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createProductionStatusRepository(),
    );
  } catch (error) {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message(error, "The status could not be updated."))}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
