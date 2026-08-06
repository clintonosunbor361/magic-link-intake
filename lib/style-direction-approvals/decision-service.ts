import { hashToken } from "@/lib/tokens";

export const APPROVAL_DECISIONS = ["approved", "with_revisions", "rejected"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export type DecisionOutcome = { ok: true } | { ok: false; reason: "inactive" };

export type StyleDirectionDecisionRepository = {
  applyDecisionAndMaybeComplete(input: {
    tokenHash: string;
    batchItemId: string;
    decision: ApprovalDecision;
    comment: string | null;
  }): Promise<DecisionOutcome>;
};

export async function recordApprovalDecision(
  input: { token: string; batchItemId: string; decision: ApprovalDecision; comment: string },
  repository: StyleDirectionDecisionRepository,
): Promise<DecisionOutcome> {
  const comment = input.comment.trim();
  if ((input.decision === "with_revisions" || input.decision === "rejected") && !comment) {
    throw new Error("A comment is required for With Revisions or Rejected decisions.");
  }

  return repository.applyDecisionAndMaybeComplete({
    tokenHash: hashToken(input.token),
    batchItemId: input.batchItemId,
    decision: input.decision,
    comment: comment || null,
  });
}
