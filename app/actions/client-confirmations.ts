"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { getRequestOrigin } from "@/lib/request-origin";
import { createClientConfirmationRepository } from "@/lib/client-confirmations/repository";
import { issueConfirmation, markConfirmationCopied, sendConfirmationEmail } from "@/lib/client-confirmations/service";
import { sendConfirmationEmail as sendConfirmationEmailViaResend } from "@/lib/email/resend";

async function confirmationUrl(token: string): Promise<string> {
  const origin = await getRequestOrigin();
  return `${origin}/confirm/${encodeURIComponent(token)}`;
}

export async function issueMeasurementConfirmationAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const measurementProfileId = readFormString(formData, "measurementProfileId");

  let confirmationId: string;
  let token: string;
  try {
    const result = await issueConfirmation(
      {
        actor: { organizationId: session.organizationId, staffId: session.userId },
        subjectType: "measurement_profile",
        subjectId: measurementProfileId,
      },
      createClientConfirmationRepository(),
    );
    confirmationId = result.confirmationId;
    token = result.token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The measurement confirmation could not be created.";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/measurement-confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}`);
}

export async function sendMeasurementConfirmationEmailAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const confirmationId = readFormString(formData, "confirmationId");
  const token = readFormString(formData, "token");

  try {
    await sendConfirmationEmail(
      {
        organizationId: session.organizationId,
        confirmationId,
        token,
        actorId: session.userId,
        recipientEmail: readFormString(formData, "recipientEmail"),
        confirmationUrl: await confirmationUrl(token),
        subjectLabel: "measurements",
        clientName: readFormString(formData, "clientName"),
      },
      createClientConfirmationRepository(),
      { sendConfirmationEmail: sendConfirmationEmailViaResend },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The confirmation email could not be sent.";
    redirect(
      `/clients/${clientId}/measurement-confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/measurement-confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&sent=1`);
}

export async function markMeasurementConfirmationCopiedAction(formData: FormData) {
  const session = await requireStaffSession();
  const clientId = readFormString(formData, "clientId");
  const confirmationId = readFormString(formData, "confirmationId");
  const token = readFormString(formData, "token");

  try {
    await markConfirmationCopied(
      { organizationId: session.organizationId, confirmationId, token, actorId: session.userId },
      createClientConfirmationRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The confirmation could not be updated.";
    redirect(
      `/clients/${clientId}/measurement-confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/measurement-confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&copied=1`);
}

export async function issueOrderConfirmationAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");

  let confirmationId: string;
  let token: string;
  try {
    const result = await issueConfirmation(
      {
        actor: { organizationId: session.organizationId, staffId: session.userId },
        subjectType: "order_detail",
        subjectId: orderId,
      },
      createClientConfirmationRepository(),
    );
    confirmationId = result.confirmationId;
    token = result.token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The order confirmation could not be created.";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}`);
}

export async function sendOrderConfirmationEmailAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const confirmationId = readFormString(formData, "confirmationId");
  const token = readFormString(formData, "token");

  try {
    await sendConfirmationEmail(
      {
        organizationId: session.organizationId,
        confirmationId,
        token,
        actorId: session.userId,
        recipientEmail: readFormString(formData, "recipientEmail"),
        confirmationUrl: await confirmationUrl(token),
        subjectLabel: "order details",
        clientName: readFormString(formData, "clientName"),
      },
      createClientConfirmationRepository(),
      { sendConfirmationEmail: sendConfirmationEmailViaResend },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The confirmation email could not be sent.";
    redirect(
      `/orders/${orderId}/confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&sent=1`);
}

export async function markOrderConfirmationCopiedAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const confirmationId = readFormString(formData, "confirmationId");
  const token = readFormString(formData, "token");

  try {
    await markConfirmationCopied(
      { organizationId: session.organizationId, confirmationId, token, actorId: session.userId },
      createClientConfirmationRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The confirmation could not be updated.";
    redirect(
      `/orders/${orderId}/confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/confirmations/${confirmationId}/created?token=${encodeURIComponent(token)}&copied=1`);
}
