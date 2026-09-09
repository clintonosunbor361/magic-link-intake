import "server-only";

import { Resend } from "resend";
import { escapeEmailHtml as escape } from "@/lib/email/content";
import { NotificationDeliveryError } from "@/lib/notifications/service";

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
    html: `<p>Hi ${escape(input.clientName)},</p><p>Please review the style direction for <strong>${escape(input.orderTitle)}</strong>:</p><p><a href="${escape(input.approvalUrl)}">Review style direction</a></p><p>This link stays active for 7 days.</p>`,
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
  idempotencyKey: string;
}): Promise<{ id: string }> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new NotificationDeliveryError("Notification email is not configured.", true);
  }
  const { data, error } = await getResendClient().emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: input.to,
    subject: input.title,
    html: `<p>Hi ${escape(input.staffName)},</p><p>${escape(input.body)}</p><p><a href="${escape(input.url)}">Open in Kuartz</a></p>`,
    text: `Hi ${input.staffName},\n\n${input.body}\n\nOpen in Kuartz: ${input.url}`,
  }, { idempotencyKey: input.idempotencyKey });
  if (error) {
    // A definitive 4xx rejection did not accept the email. Transport/5xx outcomes are uncertain.
    const retrySafe = error.statusCode !== null && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 409;
    throw new NotificationDeliveryError(`Resend: ${error.name}`, retrySafe);
  }
  if (!data) throw new NotificationDeliveryError("Resend returned no message identifier.", false);
  return data;
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
    html: `<p>Hi ${escape(input.clientName)},</p><p>Please confirm your ${escape(input.subjectLabel)}:</p><p><a href="${escape(input.confirmationUrl)}">Review confirmation</a></p><p>This link stays active for 7 days.</p>`,
  });
  if (error) throw new Error("The email could not be sent.");
}
