import { describe, expect, it, vi } from "vitest";
import { recordConfirmationDecision } from "@/lib/client-confirmations/decision-service";
import { hashToken } from "@/lib/tokens";

describe("recordConfirmationDecision", () => {
  it("delegates to the repository with the hashed token, not the raw token", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: true }) };

    const result = await recordConfirmationDecision({ token: "raw-token", decision: "confirmed", comment: "" }, repository);

    expect(result).toEqual({ ok: true });
    expect(repository.applyDecisionAndMaybeComplete).toHaveBeenCalledWith({
      tokenHash: hashToken("raw-token"),
      decision: "confirmed",
      comment: null,
    });
  });

  it("allows an empty comment for a Confirmed decision", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: true }) };

    await recordConfirmationDecision({ token: "t", decision: "confirmed", comment: "  " }, repository);

    expect(repository.applyDecisionAndMaybeComplete).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
  });

  it("requires a comment for a correction_requested decision", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn() };

    await expect(
      recordConfirmationDecision({ token: "t", decision: "correction_requested", comment: "   " }, repository),
    ).rejects.toThrow("A comment is required when requesting a correction.");
    expect(repository.applyDecisionAndMaybeComplete).not.toHaveBeenCalled();
  });

  it("trims the comment before storing it", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: true }) };

    await recordConfirmationDecision(
      { token: "t", decision: "correction_requested", comment: "  chest measurement looks off  " },
      repository,
    );

    expect(repository.applyDecisionAndMaybeComplete).toHaveBeenCalledWith(
      expect.objectContaining({ comment: "chest measurement looks off" }),
    );
  });

  it("passes through an inactive outcome from the repository", async () => {
    const repository = { applyDecisionAndMaybeComplete: vi.fn().mockResolvedValue({ ok: false, reason: "inactive" }) };

    const result = await recordConfirmationDecision({ token: "t", decision: "confirmed", comment: "" }, repository);

    expect(result).toEqual({ ok: false, reason: "inactive" });
  });
});
