"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAccessoryItemRepository } from "@/lib/accessories/repository";
import {
  archiveAccessoryItem,
  createAccessoryItem,
  restoreAccessoryItem,
  updateAccessoryItem,
} from "@/lib/accessories/service";
import { requireStaffSession } from "@/lib/auth/session";
import { parseMoneyToMinorUnits } from "@/lib/forms/money";
import { readFormString } from "@/lib/forms/read-string";

function accessoriesPath(orderId: string): string {
  return `/orders/${orderId}/accessories`;
}

function readOptionalBudget(formData: FormData): number | null {
  const raw = readFormString(formData, "budget");
  return raw ? parseMoneyToMinorUnits(raw) : null;
}

export async function createAccessoryItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await createAccessoryItem(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        orderId,
        lookId: readFormString(formData, "lookId") || null,
        accessoryTypeId: readFormString(formData, "accessoryTypeId"),
        customLabel: readFormString(formData, "customLabel") || null,
        accessoryStatusId: readFormString(formData, "accessoryStatusId") || null,
        assignedToStaffId: readFormString(formData, "assignedToStaffId") || null,
        supplier: readFormString(formData, "supplier") || null,
        budgetMinor: readOptionalBudget(formData),
        purchaseDate: readFormString(formData, "purchaseDate") || null,
        notes: readFormString(formData, "notes"),
      },
      createAccessoryItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Accessory could not be added.";
    redirect(`${accessoriesPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(accessoriesPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(accessoriesPath(orderId));
}

export async function updateAccessoryItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await updateAccessoryItem(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        accessoryItemId: readFormString(formData, "accessoryItemId"),
        orderId,
        lookId: readFormString(formData, "lookId") || null,
        accessoryTypeId: readFormString(formData, "accessoryTypeId"),
        customLabel: readFormString(formData, "customLabel") || null,
        accessoryStatusId: readFormString(formData, "accessoryStatusId"),
        assignedToStaffId: readFormString(formData, "assignedToStaffId") || null,
        supplier: readFormString(formData, "supplier") || null,
        budgetMinor: readOptionalBudget(formData),
        purchaseDate: readFormString(formData, "purchaseDate") || null,
        notes: readFormString(formData, "notes"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Accessory could not be updated.";
    redirect(`${accessoriesPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(accessoriesPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(accessoriesPath(orderId));
}

export async function archiveAccessoryItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await archiveAccessoryItem(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        accessoryItemId: readFormString(formData, "accessoryItemId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Accessory could not be updated.";
    redirect(`${accessoriesPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(accessoriesPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(accessoriesPath(orderId));
}

export async function restoreAccessoryItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await restoreAccessoryItem(
      {
        actor: { role: session.role },
        organizationId: session.organizationId,
        accessoryItemId: readFormString(formData, "accessoryItemId"),
        expectedVersion: Number(readFormString(formData, "version")),
      },
      createAccessoryItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Accessory could not be updated.";
    redirect(`${accessoriesPath(orderId)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(accessoriesPath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(accessoriesPath(orderId));
}
