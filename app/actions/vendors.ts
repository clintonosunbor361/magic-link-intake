"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createVendorRepository } from "@/lib/vendors/repository";
import { archiveVendor, createVendor, restoreVendor, updateVendor } from "@/lib/vendors/service";

function contactFrom(formData: FormData) {
  return {
    name: readFormString(formData, "name"),
    phone: readFormString(formData, "phone") || null,
    email: readFormString(formData, "email") || null,
    address: readFormString(formData, "address") || null,
  };
}

function specialtyIdsFrom(formData: FormData): string[] {
  return formData.getAll("specialtyIds").filter((value): value is string => typeof value === "string" && !!value);
}

export async function createVendorAction(formData: FormData) {
  const session = await requireStaffSession();
  // Quick-create from the assignment picker posts a returnTo so staff land back mid-assignment
  // rather than being dropped into the directory.
  const returnTo = readFormString(formData, "returnTo") || "/vendors";

  try {
    await createVendor(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        ...contactFrom(formData),
        specialtyIds: specialtyIdsFrom(formData),
      },
      createVendorRepository(),
    );
  } catch (error) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(messageFrom(error, "The Vendor could not be created."))}`);
  }

  revalidatePath("/vendors");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function updateVendorAction(formData: FormData) {
  const session = await requireStaffSession();
  const vendorId = readFormString(formData, "vendorId");

  try {
    await updateVendor(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        vendorId,
        expectedVersion: Number(readFormString(formData, "version")),
        ...contactFrom(formData),
        specialtyIds: specialtyIdsFrom(formData),
      },
      createVendorRepository(),
    );
  } catch (error) {
    redirect(`/vendors/${vendorId}?error=${encodeURIComponent(messageFrom(error, "The Vendor could not be updated."))}`);
  }

  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  redirect(`/vendors/${vendorId}`);
}

export async function archiveVendorAction(formData: FormData) {
  await setVendorArchivedState(formData, true);
}

export async function restoreVendorAction(formData: FormData) {
  await setVendorArchivedState(formData, false);
}

async function setVendorArchivedState(formData: FormData, archived: boolean) {
  const session = await requireStaffSession();
  const vendorId = readFormString(formData, "vendorId");
  const input = {
    actor: { role: session.role },
    organizationId: session.organizationId,
    vendorId,
    expectedVersion: Number(readFormString(formData, "version")),
  };

  try {
    await (archived ? archiveVendor : restoreVendor)(input, createVendorRepository());
  } catch (error) {
    redirect(`/vendors/${vendorId}?error=${encodeURIComponent(messageFrom(error, "The Vendor could not be updated."))}`);
  }

  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  redirect(`/vendors/${vendorId}`);
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
