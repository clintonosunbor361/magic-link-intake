import { type NextRequest, NextResponse } from "next/server";
import { businessToday } from "@/lib/domain/business-date";
import { sendDeadlineEmail } from "@/lib/email/resend";
import {
  collectDeadlineSources,
  createNotificationRepository,
  listOrganizationsForCron,
} from "@/lib/notifications/repository";
import { dispatchNotifications, planNotifications } from "@/lib/notifications/service";

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
  const email = { sendDeadlineEmail };
  const appOrigin = resolveAppOrigin(request);

  const results = [];
  for (const organization of organizations) {
    // One organization's failure must not abort the rest of the run.
    try {
      const today = businessToday(organization.timezone);
      const sources = await collectDeadlineSources(organization.id, organization.timezone);
      const planned = planNotifications({ sources, today });

      const outcome = await dispatchNotifications(
        { organizationId: organization.id, planned, appOrigin },
        repository,
        email,
      );

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
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  const host = request.headers.get("host");
  return host ? `https://${host}` : "";
}
