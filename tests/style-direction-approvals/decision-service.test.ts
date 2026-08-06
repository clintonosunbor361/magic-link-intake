import { describe, expect, it, vi } from "vitest";
import { recordApprovalDecision } from "@/lib/style-direction-approvals/decision-service";
import { hashToken } from "@/lib/tokens";

describe("recordApprovalDecision", () => {
  it("delegates to the repository with the hashed token, not the raw token", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: true }) };

    const result = await recordApprovalDecision(
      { token: "raw-token", batchItemId: "item-1", decision: "approved", comment: "" },
      repository,
    );

    expect(result).toEqual({ ok: true });
    expect(repository.applyDecisionAndMaybeComplete).toHaveBeenCalledWith({
      tokenHash: hashToken("raw-token"),
      batchItemId: "item-1",
      decision: "approved",
      comment: null,
    });
  });

  it("allows an empty comment for an Approved decision", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: true }) };

    await recordApprovalDecision({ token: "t", batchItemId: "item-1", decision: "approved", comment: "  " }, repository);

    expect(repository.applyDecisionAndMaybeComplete).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
  });

  it.each(["with_revisions", "rejected"] as const)("requires a comment for a %s decision", async (decision) => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn() };

    await expect(
      recordApprovalDecision({ token: "t", batchItemId: "item-1", decision, comment: "   " }, repository),
    ).rejects.toThrow("A comment is required for With Revisions or Rejected decisions.");
    expect(repository.applyDecisionAndMaybeComplete).not.toHaveBeenCalled();
  });

  it("trims the comment before storing it", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: true }) };

    await recordApprovalDecision(
      { token: "t", batchItemId: "item-1", decision: "rejected", comment: "  needs a smaller collar  " },
      repository,
    );

    expect(repository.applyDecisionAndMaybeComplete).toHaveBeenCalledWith(expect.objectContaining({ comment: "needs a smaller collar" }));
  });

  it("passes through an inactive outcome from the repository", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: false, reason: "inactive" }) };

    const result = await recordApprovalDecision({ token: "t", batchItemId: "item-1", decision: "approved", comment: "" }, repository);

    expect(result).toEqual({ ok: false, reason: "inactive" });
  });
});
