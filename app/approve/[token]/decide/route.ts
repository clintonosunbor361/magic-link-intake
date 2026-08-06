import { NextRequest, NextResponse } from "next/server";
import { APPROVAL_DECISIONS, recordApprovalDecision } from "@/lib/style-direction-approvals/decision-service";
import { createStyleDirectionDecisionRepository } from "@/lib/style-direction-approvals/repository";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const formData = await request.formData();
  const batchItemId = String(formData.get("batchItemId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "");

  const approvalUrl = new URL(`/approve/${encodeURIComponent(token)}`, request.url);

  if (!APPROVAL_DECISIONS.includes(decision as (typeof APPROVAL_DECISIONS)[number])) {
    approvalUrl.searchParams.set("error", "Select a valid decision.");
    approvalUrl.searchParams.set("itemId", batchItemId);
    return NextResponse.redirect(approvalUrl, { status: 303 });
  }

  try {
    const result = await recordApprovalDecision(
      { token, batchItemId, decision: decision as (typeof APPROVAL_DECISIONS)[number], comment },
      createStyleDirectionDecisionRepository(),
    );
    if (!result.ok) {
      return NextResponse.redirect(new URL("/approve/inactive", request.url), { status: 303 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The decision could not be recorded.";
    approvalUrl.searchParams.set("error", message);
    approvalUrl.searchParams.set("itemId", batchItemId);
    return NextResponse.redirect(approvalUrl, { status: 303 });
  }

  return NextResponse.redirect(new URL(`/approve/${encodeURIComponent(token)}`, request.url), { status: 303 });
}
