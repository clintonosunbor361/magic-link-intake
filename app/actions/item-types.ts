"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { createItemTypeRepository } from "@/lib/item-types/repository";
import { archiveItemType, createItemType, restoreItemType } from "@/lib/item-types/service";
import { readFormString } from "@/lib/forms/read-string";

export async function createItemTypeAction(formData: FormData) {
  const session = await requireStaffSession();
  const name = readFormString(formData, "name");
  const sortOrder = Number(readFormString(formData, "sortOrder"));

  try {
    await createItemType(
      { actor: { role: session.role }, organizationId: session.organizationId, name, sortOrder },
      createItemTypeRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item Type could not be created.";
    redirect(`/settings/item-types?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/item-types");
  redirect("/settings/item-types");
}

export async function archiveItemTypeAction(formData: FormData) {
  const session = await requireStaffSession();
  const itemTypeId = readFormString(formData, "itemTypeId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveItemType(
      { actor: { role: session.role }, organizationId: session.organizationId, itemTypeId, expectedVersion },
      createItemTypeRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item Type could not be updated.";
    redirect(`/settings/item-types?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/item-types");
  redirect("/settings/item-types");
}

export async function restoreItemTypeAction(formData: FormData) {
  const session = await requireStaffSession();
  const itemTypeId = readFormString(formData, "itemTypeId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreItemType(
      { actor: { role: session.role }, organizationId: session.organizationId, itemTypeId, expectedVersion },
      createItemTypeRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item Type could not be updated.";
    redirect(`/settings/item-types?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/item-types");
  redirect("/settings/item-types");
}
