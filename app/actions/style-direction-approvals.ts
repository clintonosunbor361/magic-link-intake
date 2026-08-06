"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { createStyleDirectionApprovalRepository } from "@/lib/style-direction-approvals/repository";
import { createApprovalBatch, markApprovalBatchCopied, sendApprovalBatchEmail } from "@/lib/style-direction-approvals/batch-service";
import { sendApprovalBatchEmail as sendApprovalBatchEmailViaResend } from "@/lib/email/resend";
import { getRequestOrigin } from "@/lib/request-origin";

async function approvalUrl(token: string): Promise<string> {
  const origin = await getRequestOrigin();
  return `${origin}/approve/${encodeURIComponent(token)}`;
}

export async function createApprovalBatchAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const fileIds = formData.getAll("fileIds").map((value) => String(value));

  let batchId: string;
  let token: string;
  try {
    const result = await createApprovalBatch(
      { actor: { organizationId: session.organizationId, staffId: session.userId }, orderId, fileIds },
      createStyleDirectionApprovalRepository(),
    );
    batchId = result.batchId;
    token = result.token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The approval batch could not be created.";
    redirect(`/orders/${orderId}/approval-batches/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/approval-batches/${batchId}/created?token=${encodeURIComponent(token)}`);
}

export async function sendApprovalBatchEmailAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const batchId = readFormString(formData, "batchId");
  const token = readFormString(formData, "token");

  try {
    await sendApprovalBatchEmail(
      {
        organizationId: session.organizationId,
        batchId,
        token,
        actorId: session.userId,
        recipientEmail: readFormString(formData, "recipientEmail"),
        approvalUrl: await approvalUrl(token),
        orderTitle: readFormString(formData, "orderTitle"),
        clientName: readFormString(formData, "clientName"),
      },
      createStyleDirectionApprovalRepository(),
      { sendApprovalBatchEmail: sendApprovalBatchEmailViaResend },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The approval batch email could not be sent.";
    redirect(`/orders/${orderId}/approval-batches/${batchId}/created?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/approval-batches/${batchId}/created?token=${encodeURIComponent(token)}&sent=1`);
}

export async function markApprovalBatchCopiedAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const batchId = readFormString(formData, "batchId");
  const token = readFormString(formData, "token");

  try {
    await markApprovalBatchCopied(
      { organizationId: session.organizationId, batchId, token, actorId: session.userId },
      createStyleDirectionApprovalRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The approval batch could not be updated.";
    redirect(`/orders/${orderId}/approval-batches/${batchId}/created?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}/approval-batches/${batchId}/created?token=${encodeURIComponent(token)}&copied=1`);
}
