"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { createOrderInvoice, updateDraftInvoice, voidInvoice } from "@/lib/finance/invoice-service";
import { createInvoiceRepository } from "@/lib/finance/repository";
import { parseMoneyToMinorUnits } from "@/lib/forms/money";
import { readFormString } from "@/lib/forms/read-string";
import type { InvoiceLineItemInput } from "@/lib/finance/invoice";

/**
 * Line items arrive as parallel arrays from repeated form fields. A row with no description and no
 * amount is a blank spare row in the form, not an attempt to invoice nothing, so it is dropped
 * before validation rather than rejected.
 */
function readLineItems(formData: FormData): InvoiceLineItemInput[] {
  const descriptions = formData.getAll("lineDescription").map((value) => String(value));
  const quantities = formData.getAll("lineQuantity").map((value) => String(value));
  const unitPrices = formData.getAll("lineUnitPrice").map((value) => String(value));

  return descriptions
    .map((description, index) => ({
      description: description.trim(),
      quantityRaw: (quantities[index] ?? "").trim(),
      unitPriceRaw: (unitPrices[index] ?? "").trim(),
    }))
    .filter((row) => row.description || row.quantityRaw || row.unitPriceRaw)
    .map((row) => ({
      description: row.description,
      quantity: Number(row.quantityRaw || "0"),
      unitPriceMinor: parseMoneyToMinorUnits(row.unitPriceRaw || "0"),
    }));
}

function readDueDate(formData: FormData): string | null {
  return readFormString(formData, "dueDate") || null;
}

export async function createInvoiceAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  try {
    await createOrderInvoice(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        orderId,
        issueDate: readFormString(formData, "issueDate"),
        dueDate: readDueDate(formData),
        notes: readFormString(formData, "notes"),
        paymentInstructions: readFormString(formData, "paymentInstructions"),
        lines: readLineItems(formData),
      },
      createInvoiceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Invoice could not be created.";
    redirect(`/orders/${orderId}/invoice?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}/invoice`);
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/invoice`);
}

export async function updateInvoiceAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const invoiceId = readFormString(formData, "invoiceId");

  try {
    await updateDraftInvoice(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        invoiceId,
        expectedVersion: Number(readFormString(formData, "version")),
        issueDate: readFormString(formData, "issueDate"),
        dueDate: readDueDate(formData),
        notes: readFormString(formData, "notes"),
        paymentInstructions: readFormString(formData, "paymentInstructions"),
        lines: readLineItems(formData),
      },
      createInvoiceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Invoice could not be updated.";
    redirect(`/orders/${orderId}/invoice?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}/invoice`);
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/invoice`);
}

export async function voidInvoiceAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const invoiceId = readFormString(formData, "invoiceId");

  try {
    await voidInvoice(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        invoiceId,
        expectedVersion: Number(readFormString(formData, "version")),
        reason: readFormString(formData, "reason"),
      },
      createInvoiceRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Invoice could not be voided.";
    redirect(`/orders/${orderId}/invoice?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}/invoice`);
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/invoice`);
}
