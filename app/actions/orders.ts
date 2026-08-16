"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
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
      firstLook: { name: readFormString(formData, "lookName"), lookDate: readFormString(formData, "lookDate") || null, notes: readFormString(formData, "lookNotes") },
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
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function archiveOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveOrder(
      { actor: { organizationId: session.organizationId, role: session.role }, orderId, expectedVersion },
      createOrderRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be updated.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function restoreOrderAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreOrder(
      { actor: { organizationId: session.organizationId, role: session.role }, orderId, expectedVersion },
      createOrderRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Order could not be updated.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function createLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

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
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function updateLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const expectedVersion = Number(readFormString(formData, "version"));

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
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function archiveLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveLook(
      { actor: { organizationId: session.organizationId, role: session.role }, orderId, lookId, expectedVersion },
      createLookRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Look could not be updated.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function restoreLookAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreLook(
      { actor: { organizationId: session.organizationId, role: session.role }, lookId, expectedVersion },
      createLookRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Look could not be updated.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function createItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const lookId = readFormString(formData, "lookId");

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
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function updateItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const itemId = readFormString(formData, "itemId");
  const expectedVersion = Number(readFormString(formData, "version"));

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
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function archiveItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const itemId = readFormString(formData, "itemId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await archiveItem(
      { actor: { organizationId: session.organizationId, role: session.role }, itemId, expectedVersion },
      createItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item could not be updated.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function restoreItemAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const itemId = readFormString(formData, "itemId");
  const expectedVersion = Number(readFormString(formData, "version"));

  try {
    await restoreItem(
      { actor: { organizationId: session.organizationId, role: session.role }, itemId, expectedVersion },
      createItemRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Item could not be updated.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}
