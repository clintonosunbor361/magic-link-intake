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

function brandedSender(configured: string): string {
  const bracketedAddress = configured.match(/<([^<>]+)>/)?.[1]?.trim();
  return `Kuartz CRM <${bracketedAddress ?? configured.trim()}>`;
}

function authEmailHtml(input: {
  eyebrow: string;
  heading: string;
  greeting: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
}): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f4f0e8;color:#171714;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f0e8;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #ddd5c7">
<tr><td style="padding:26px 32px;background:#171714;color:#fff;font-size:20px;font-weight:700;letter-spacing:.08em">KUARTZ CRM</td></tr>
<tr><td style="padding:36px 32px">
<p style="margin:0 0 12px;color:#8a6a2f;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">${escape(input.eyebrow)}</p>
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:30px;line-height:1.2;font-weight:500">${escape(input.heading)}</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.65">${escape(input.greeting)}</p>
<p style="margin:0 0 26px;font-size:16px;line-height:1.65;color:#4d4b45">${escape(input.body)}</p>
<p style="margin:0 0 28px"><a href="${escape(input.actionUrl)}" style="display:inline-block;background:#171714;color:#fff;text-decoration:none;padding:14px 22px;font-size:15px;font-weight:700">${escape(input.actionLabel)}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#77736a">This secure link expires in 60 minutes and can only be used once.</p>
<p style="margin:0;font-size:13px;line-height:1.55;color:#77736a">If you weren’t expecting this email, you can safely ignore it.</p>
</td></tr></table>
</td></tr></table></body></html>`;
}

export async function sendStaffInviteEmail(input: {
  to: string;
  staffName: string;
  inviteUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: brandedSender(requireEnv("RESEND_FROM_EMAIL")),
    to: input.to,
    subject: "You’re invited to Kuartz CRM",
    html: authEmailHtml({
      eyebrow: "Your staff access is ready",
      heading: "Welcome to Kuartz CRM",
      greeting: `Hi ${input.staffName},`,
      body: "You’ve been invited to join the Kuartz team workspace. Create your password to securely access clients, orders, and production workflows.",
      actionLabel: "Create your account",
      actionUrl: input.inviteUrl,
    }),
    text: `Hi ${input.staffName},\n\nYou’ve been invited to join the Kuartz team workspace.\n\nCreate your account: ${input.inviteUrl}\n\nThis secure link expires in 60 minutes and can only be used once.`,
  }, { idempotencyKey: input.idempotencyKey });
  if (error) throw new Error("The invitation email could not be sent.");
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: brandedSender(requireEnv("RESEND_FROM_EMAIL")),
    to: input.to,
    subject: "Reset your Kuartz CRM password",
    html: authEmailHtml({
      eyebrow: "Account recovery",
      heading: "Choose a new password",
      greeting: "Hello,",
      body: "We received a request to reset the password for your Kuartz CRM staff account.",
      actionLabel: "Reset password",
      actionUrl: input.resetUrl,
    }),
    text: `We received a request to reset your Kuartz CRM password.\n\nReset password: ${input.resetUrl}\n\nThis secure link expires in 60 minutes and can only be used once.`,
  }, { idempotencyKey: input.idempotencyKey });
  if (error) throw new Error("The password reset email could not be sent.");
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
