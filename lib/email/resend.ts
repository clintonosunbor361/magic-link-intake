import "server-only";

import { Resend } from "resend";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

let client: Resend | null = null;

function getResendClient(): Resend {
  if (!client) client = new Resend(requireEnv("RESEND_API_KEY"));
  return client;
}

export async function sendApprovalBatchEmail(input: {
  to: string;
  approvalUrl: string;
  orderTitle: string;
  clientName: string;
}): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: input.to,
    subject: `Style direction ready for your review — ${input.orderTitle}`,
    html: `<p>Hi ${input.clientName},</p><p>Please review the style direction for <strong>${input.orderTitle}</strong>:</p><p><a href="${input.approvalUrl}">${input.approvalUrl}</a></p><p>This link stays active for 7 days.</p>`,
  });
  if (error) throw new Error("The email could not be sent.");
}
