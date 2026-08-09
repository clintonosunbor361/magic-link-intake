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

// The only staff-facing email in Phase 1 — every other template addresses a client. It goes to the
// person responsible for the deadline, and links straight to the record rather than the dashboard.
export async function sendDeadlineEmail(input: {
  to: string;
  staffName: string;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: input.to,
    subject: input.title,
    html: `<p>Hi ${input.staffName},</p><p>${input.body}</p><p><a href="${input.url}">Open in Kuartz</a></p>`,
  });
  if (error) throw new Error("The email could not be sent.");
}

export async function sendConfirmationEmail(input: {
  to: string;
  confirmationUrl: string;
  subjectLabel: string;
  clientName: string;
}): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: input.to,
    subject: `Please confirm your ${input.subjectLabel}`,
    html: `<p>Hi ${input.clientName},</p><p>Please confirm your ${input.subjectLabel}:</p><p><a href="${input.confirmationUrl}">${input.confirmationUrl}</a></p><p>This link stays active for 7 days.</p>`,
  });
  if (error) throw new Error("The email could not be sent.");
}
