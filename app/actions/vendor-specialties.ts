"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createVendorSpecialtyRepository } from "@/lib/vendor-specialties/repository";
import {
  archiveVendorSpecialty,
  createVendorSpecialty,
  restoreVendorSpecialty,
} from "@/lib/vendor-specialties/service";

const SETTINGS_PATH = "/settings/vendor-specialties";

export async function createVendorSpecialtyAction(formData: FormData) {
  const session = await requireStaffSession();

  try {
    await createVendorSpecialty(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        name: readFormString(formData, "name"),
        sortOrder: Number(readFormString(formData, "sortOrder")),
      },
      createVendorSpecialtyRepository(),
    );
  } catch (error) {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message(error, "The specialty could not be created."))}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

export async function archiveVendorSpecialtyAction(formData: FormData) {
  await setArchivedState(formData, true);
}

export async function restoreVendorSpecialtyAction(formData: FormData) {
  await setArchivedState(formData, false);
}

async function setArchivedState(formData: FormData, archived: boolean) {
  const session = await requireStaffSession();
  const input = {
    actor: { role: session.role },
    organizationId: session.organizationId,
    specialtyId: readFormString(formData, "specialtyId"),
    expectedVersion: Number(readFormString(formData, "version")),
  };

  try {
    await (archived ? archiveVendorSpecialty : restoreVendorSpecialty)(input, createVendorSpecialtyRepository());
  } catch (error) {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(message(error, "The specialty could not be updated."))}`);
  }

  revalidatePath(SETTINGS_PATH);
  redirect(SETTINGS_PATH);
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
