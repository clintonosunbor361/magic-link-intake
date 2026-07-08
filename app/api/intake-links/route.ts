import { NextResponse } from "next/server";
import { createMagicLinkToken } from "@/lib/magic-links";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { token } = await createMagicLinkToken();
  const url = new URL(`/intake/${token}`, request.url);

  return NextResponse.json({
    url: url.toString(),
  });
}
