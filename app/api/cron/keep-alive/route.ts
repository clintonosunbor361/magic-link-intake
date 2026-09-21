import { type NextRequest, NextResponse } from "next/server";
import { listOrganizationsForCron } from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const organizations = await listOrganizationsForCron();

  return NextResponse.json(
    {
      ok: true,
      ranAt: new Date().toISOString(),
      organizationCount: organizations.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
