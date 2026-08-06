import { NextRequest, NextResponse } from "next/server";
import { CLIENT_CONFIRMATION_DECISIONS, recordConfirmationDecision } from "@/lib/client-confirmations/decision-service";
import { createClientConfirmationDecisionRepository } from "@/lib/client-confirmations/repository";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const formData = await request.formData();
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "");

  const confirmUrl = new URL(`/confirm/${encodeURIComponent(token)}`, request.url);

  if (!CLIENT_CONFIRMATION_DECISIONS.includes(decision as (typeof CLIENT_CONFIRMATION_DECISIONS)[number])) {
    confirmUrl.searchParams.set("error", "Select a valid decision.");
    return NextResponse.redirect(confirmUrl, { status: 303 });
  }

  try {
    const result = await recordConfirmationDecision(
      { token, decision: decision as (typeof CLIENT_CONFIRMATION_DECISIONS)[number], comment },
      createClientConfirmationDecisionRepository(),
    );
    if (!result.ok) {
      return NextResponse.redirect(new URL("/confirm/inactive", request.url), { status: 303 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The decision could not be recorded.";
    confirmUrl.searchParams.set("error", message);
    return NextResponse.redirect(confirmUrl, { status: 303 });
  }

  return NextResponse.redirect(confirmUrl, { status: 303 });
}
