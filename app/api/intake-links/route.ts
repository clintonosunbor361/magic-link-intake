import { NextResponse } from "next/server";
import { createMagicLinkToken } from "@/lib/magic-links";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { token } = await createMagicLinkToken({
    organizationId: session.organizationId,
    generatedByStaffId: session.userId,
  });
  const url = new URL(`/i/${token}`, request.url);

  return NextResponse.json({
    url: url.toString(),
  });
}
