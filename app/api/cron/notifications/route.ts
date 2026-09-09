import { type NextRequest, NextResponse } from "next/server";
import { setTimeout as delay } from "node:timers/promises";
import { businessToday } from "@/lib/domain/business-date";
import { sendDeadlineEmail } from "@/lib/email/resend";
import {
  collectDeadlineSources,
  createNotificationRepository,
  listOrganizationsForCron,
} from "@/lib/notifications/repository";
import { dispatchNotifications, EMAIL_BATCH_SIZE, planNotifications } from "@/lib/notifications/service";

// Scheduled daily at 06:00 UTC (07:00 in Africa/Lagos) by vercel.json — early enough that the
// dashboard is current when staff arrive, and far enough from the Lagos date rollover that "due
// today" is never ambiguous.
//
// Every organization is processed in its own timezone, because a deadline is a business fact and
// this route has no viewer whose zone it could otherwise borrow.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authorized = isAuthorized(request);
  if (!authorized) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const organizations = await listOrganizationsForCron();
  const repository = createNotificationRepository();
  const email = { sendDeadlineEmail: async (input: Parameters<typeof sendDeadlineEmail>[0]) => {
    await delay(600); // Stay below Resend's default two requests per second.
    return sendDeadlineEmail(input);
  } };
  const appOrigin = resolveAppOrigin(request);

  const results = [];
  const startedAt = Date.now();
  for (const organization of organizations) {
    // One organization's failure must not abort the rest of the run.
    try {
      const today = businessToday(organization.timezone);
      const sources = await collectDeadlineSources(organization.id, organization.timezone);
      const planned = planNotifications({ sources, today });

      if (request.nextUrl.searchParams.get("dryRun") === "1") {
        const pending = await repository.listEmailCandidates(organization.id);
        results.push({ organizationId: organization.id, today, sources: sources.length,
          planned: planned.length, emailEligible: planned.filter((plan) => plan.emailEligible).length,
          queued: pending.length, emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL), dryRun: true });
        continue;
      }

      const outcome = await dispatchNotifications(
        { organizationId: organization.id, planned, appOrigin },
        repository,
        email,
      );

      // Retry transient failures while the provider's idempotency key is still retained.
      // Persisted, definitively rejected attempts also remain eligible for tomorrow's run.
      let remainingFailures = outcome.failed;
      let lastBatchSize = outcome.emailed + outcome.failed;
      let retryRounds = 0;
      while (Date.now() - startedAt < 180_000 && (lastBatchSize >= EMAIL_BATCH_SIZE || (remainingFailures > 0 && retryRounds < 2))) {
        if (remainingFailures > 0) { retryRounds += 1; await delay(1000 * retryRounds); }
        const retry = await dispatchNotifications({ organizationId: organization.id, planned, appOrigin }, repository, email);
        outcome.created += retry.created;
        outcome.emailed += retry.emailed;
        outcome.skipped += retry.skipped;
        remainingFailures = retry.failed;
        lastBatchSize = retry.emailed + retry.failed;
      }
      outcome.failed = remainingFailures;

      results.push({ organizationId: organization.id, today, sources: sources.length, ...outcome });
    } catch (error) {
      results.push({
        organizationId: organization.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Vercel Cron sends the project's CRON_SECRET as a bearer token. Without this check the route would
 * be an open endpoint that anyone could use to trigger email sends.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function resolveAppOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  return request.nextUrl.origin;
}
