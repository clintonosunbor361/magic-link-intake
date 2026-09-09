import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Resend } from "resend";
import { sendDeadlineEmail } from "../lib/email/resend";

process.loadEnvFile(".env.local");
const recipient = process.argv[2];
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Provide an explicitly authorized test recipient.");
const { id } = await sendDeadlineEmail({
  to: recipient, staffName: "Emmanuel", title: "[TEST] Kuartz notification delivery check",
  body: "This is the notification test you requested. Deadline reminders and automatic failed-delivery retries are being verified. No Client or Order needs action for this test.",
  url: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/notifications`,
  idempotencyKey: `notification-test/${randomUUID()}`,
});
console.log(JSON.stringify({ accepted: true, emailId: id }));
const resend = new Resend(process.env.RESEND_API_KEY);
for (let attempt = 0; attempt < 10; attempt += 1) {
  await delay(2000);
  const { data, error } = await resend.emails.get(id);
  if (error) { console.log(JSON.stringify({ providerStatusCheck: error.name })); break; }
  if (data?.last_event && data.last_event !== "sent") {
    console.log(JSON.stringify({ emailId: id, lastEvent: data.last_event })); break;
  }
  if (attempt === 9) console.log(JSON.stringify({ emailId: id, lastEvent: data?.last_event ?? "unknown" }));
}
