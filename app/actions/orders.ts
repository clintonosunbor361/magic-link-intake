"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { safeReturnPath, withReturnError } from "@/lib/forms/return-path";
import { parseMoneyToMinorUnits } from "@/lib/forms/money";
import { createActiveOrderRepository, createItemRepository, createLookRepository, createOrderRepository } from "@/lib/orders/repository";
import { archiveOrder, createActiveOrder, restoreOrder, updateOrderDetails } from "@/lib/orders/order-service";
import { archiveLook, createLook, restoreLook, updateLook } from "@/lib/orders/look-service";
import { archiveItem, createItem, restoreItem, updateItem } from "@/lib/orders/item-service";

export async function createActiveOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const creationSource = readFormString(formData, "creationSource");
  const discount = readFormString(formData, "ffDiscountAmount");
  const lookNames = formData.getAll("lookName").map((value) => String(value));
  const lookDates = formData.getAll("lookDate").map((value) => String(value));
  const lookNotes = formData.getAll("lookNotes").map((value) => String(value));
  let orderId: string;
  try {
    ({ orderId } = await createActiveOrder({ organizationId: session.organizationId, actorStaffId: session.userId, fields: {
      clientId,
      title: readFormString(formData, "title"),
      eventType: readFormString(formData, "eventType"),
      finalAgreedPriceMinor: parseMoneyToMinorUnits(readFormString(formData, "finalAgreedPrice")),
      primaryOwnerStaffId: readFormString(formData, "primaryOwnerStaffId") || session.userId,
      ffDiscount: formData.get("ffDiscount") === "on",
      ffDiscountAmountMinor: discount ? parseMoneyToMinorUnits(discount) : null,
      looks: lookNames.map((name, index) => ({
        name,
        lookDate: lookDates[index] || null,
        notes: lookNotes[index] ?? "",
      })),
    } }, createActiveOrderRepository()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be created.";
    const errorPath = creationSource === "orders" ? "/orders/new" : `/clients/${clientId}/orders/new`;
    redirect(`${errorPath}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function updateOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const ffDiscountAmount = readFormString(formData, "ffDiscountAmount");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await updateOrderDetails(
      {
        organizationId: session.organizationId,
        orderId,
        expectedVersion,
        fields: {
          title: readFormString(formData, "title"),
          eventType: readFormString(formData, "eventType"),
          finalAgreedPriceMinor: parseMoneyToMinorUnits(readFormString(formData, "finalAgreedPrice")),
          ffDiscount: formData.get("ffDiscount") === "on",
          ffDiscountAmountMinor: ffDiscountAmount ? parseMoneyToMinorUnits(ffDiscountAmount) : null,
        },
      },
      createOrderRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function archiveOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await archiveOrder(
      { actor: { organizationId: session.organizationId, role: session.role }, orderId, expectedVersion },
      createOrderRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function restoreOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await restoreOrder(
      { actor: { organizationId: session.organizationId, role: session.role }, orderId, expectedVersion },
      createOrderRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function createLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await createLook(
      {
        organizationId: session.organizationId,
        orderId,
        fields: {
          name: readFormString(formData, "name"),
          lookDate: readFormString(formData, "lookDate") || null,
          notes: readFormString(formData, "notes"),
        },
      },
      createLookRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Look could not be created.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function updateLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await updateLook(
      {
        organizationId: session.organizationId,
        lookId,
        expectedVersion,
        fields: {
          name: readFormString(formData, "name"),
          lookDate: readFormString(formData, "lookDate") || null,
          notes: readFormString(formData, "notes"),
        },
      },
      createLookRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Look could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function archiveLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await archiveLook(
      { actor: { organizationId: session.organizationId, role: session.role }, orderId, lookId, expectedVersion },
      createLookRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Look could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function restoreLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await restoreLook(
      { actor: { organizationId: session.organizationId, role: session.role }, lookId, expectedVersion },
      createLookRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Look could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function createItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await createItem(
      {
        organizationId: session.organizationId,
        lookId,
        fields: {
          itemTypeId: readFormString(formData, "itemTypeId"),
          customLabel: readFormString(formData, "customLabel") || null,
          quantity: Number(readFormString(formData, "quantity")),
        },
      },
      createItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item could not be created.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function updateItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const itemId = readFormString(formData, "itemId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await updateItem(
      {
        organizationId: session.organizationId,
        itemId,
        expectedVersion,
        fields: {
          itemTypeId: readFormString(formData, "itemTypeId"),
          customLabel: readFormString(formData, "customLabel") || null,
          quantity: Number(readFormString(formData, "quantity")),
        },
      },
      createItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function archiveItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const itemId = readFormString(formData, "itemId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await archiveItem(
      { actor: { organizationId: session.organizationId, role: session.role }, itemId, expectedVersion },
      createItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function restoreItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const itemId = readFormString(formData, "itemId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}`);

  try {
    await restoreItem(
      { actor: { organizationId: session.organizationId, role: session.role }, itemId, expectedVersion },
      createItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}
