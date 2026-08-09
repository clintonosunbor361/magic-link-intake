"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAccessoryTypeRepository } from "@/lib/accessory-types/repository";
import {
  archiveAccessoryType,
  createAccessoryType,
  restoreAccessoryType,
} from "@/lib/accessory-types/service";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";

const SETTINGS_PATH = "/settings/accessory-types";

export async function createAccessoryTypeAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await createAccessoryType(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        name: readFormString(formData, "name"),
        sortOrder: Number(readFormString(formData, "sortOrder")),
      },
      createAccessoryTypeRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory type could not be created.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function archiveAccessoryTypeAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await archiveAccessoryType(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        accessoryTypeId: readFormString(formData, "accessoryTypeId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryTypeRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory type could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function restoreAccessoryTypeAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await restoreAccessoryType(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        accessoryTypeId: readFormString(formData, "accessoryTypeId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryTypeRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The accessory type could not be updated.";
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}
