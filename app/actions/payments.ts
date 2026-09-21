"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import {
  editClientPayment,
  recordClientPayment,
  recordVendorPayment,
  voidClientPayment,
  voidVendorPayment,
} from "@/lib/finance/payment-service";
import {
  createClientPaymentRepository,
  createVendorPaymentRepository,
  createVendorPaymentStorage,
} from "@/lib/finance/repository";
import { parseMoneyToMinorUnits } from "@/lib/forms/money";
import { readFormString } from "@/lib/forms/read-string";
import { safeReturnPath, withReturnError, withReturnErrorContext } from "@/lib/forms/return-path";

function readPayment(formData: FormData) {
  return {
    amountMinor: parseMoneyToMinorUnits(readFormString(formData, "amount")),
    paidOn: readFormString(formData, "paidOn"),
    reference: readFormString(formData, "reference"),
  };
}

function invoicePath(orderId: string): string {
  return `/orders/${orderId}/invoice`;
}

function readInvoiceReturnTo(formData: FormData, orderId: string): string {
  return safeReturnPath(readFormString(formData, "returnTo"), invoicePath(orderId));
}

export async function recordClientPaymentAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = readInvoiceReturnTo(formData, orderId);

  try {
    await recordClientPayment(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        invoiceId: readFormString(formData, "invoiceId"),
        payment: readPayment(formData),
      },
      createClientPaymentRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be recorded.";
    redirect(withReturnErrorContext(returnTo, message, "payment"));
  }

  revalidatePath(invoicePath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function editClientPaymentAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = readInvoiceReturnTo(formData, orderId);

  try {
    await editClientPayment(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        paymentId: readFormString(formData, "paymentId"),
        expectedVersion: Number(readFormString(formData, "version")),
        payment: readPayment(formData),
      },
      createClientPaymentRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(invoicePath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function voidClientPaymentAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = readInvoiceReturnTo(formData, orderId);

  try {
    await voidClientPayment(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        paymentId: readFormString(formData, "paymentId"),
        expectedVersion: Number(readFormString(formData, "version")),
        reason: readFormString(formData, "reason"),
      },
      createClientPaymentRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be voided.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(invoicePath(orderId));
  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function recordVendorPaymentAction(formData: FormData) {
  const session = await requireStaffSession();
  const assignmentId = readFormString(formData, "assignmentId");

  try {
    const file = formData.get("receipt");
    const receipt =
      file instanceof File && file.size > 0
        ? { buffer: Buffer.from(await file.arrayBuffer()), declaredMimeType: file.type }
        : null;

    await recordVendorPayment(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        assignmentId,
        payment: readPayment(formData),
        receipt,
      },
      createVendorPaymentRepository(),
      createVendorPaymentStorage(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Vendor payment could not be recorded.";
    redirect(`/production/${assignmentId}?error=${encodeURIComponent(message)}&modal=vendor-payment`);
  }

  revalidatePath(`/production/${assignmentId}`);
  redirect(`/production/${assignmentId}`);
}

export async function voidVendorPaymentAction(formData: FormData) {
  const session = await requireStaffSession();
  const assignmentId = readFormString(formData, "assignmentId");

  try {
    await voidVendorPayment(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        paymentId: readFormString(formData, "paymentId"),
        expectedVersion: Number(readFormString(formData, "version")),
        reason: readFormString(formData, "reason"),
      },
      createVendorPaymentRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Vendor payment could not be voided.";
    redirect(`/production/${assignmentId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/production/${assignmentId}`);
  redirect(`/production/${assignmentId}`);
}
