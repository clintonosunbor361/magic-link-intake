import { hashToken } from "@/lib/tokens";

export const CLIENT_CONFIRMATION_DECISIONS = ["confirmed", "correction_requested"] as const;
export type ClientConfirmationDecision = (typeof CLIENT_CONFIRMATION_DECISIONS)[number];

export type ConfirmationDecisionOutcome = { ok: true } | { ok: false; reason: "inactive" };

export type ClientConfirmationDecisionRepository = {
  applyDecisionAndMaybeComplete(input: {
    tokenHash: string;
    decision: ClientConfirmationDecision;
    comment: string | null;
  }): Promise<ConfirmationDecisionOutcome>;
};

export async function recordConfirmationDecision(
  input: { token: string; decision: ClientConfirmationDecision; comment: string },
  repository: ClientConfirmationDecisionRepository,
): Promise<ConfirmationDecisionOutcome> {
  const comment = input.comment.trim();
  if (input.decision === "correction_requested" && !comment) {
    throw new Error("A comment is required when requesting a correction.");
  }

  return repository.applyDecisionAndMaybeComplete({
    tokenHash: hashToken(input.token),
    decision: input.decision,
    comment: comment || null,
  });
}
