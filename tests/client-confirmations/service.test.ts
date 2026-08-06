import { describe, expect, it, vi } from "vitest";
import { issueConfirmation, markConfirmationCopied, sendConfirmationEmail } from "@/lib/client-confirmations/service";
import { hashToken } from "@/lib/tokens";

const baseRepository = () => ({
  subjectExists: vi.fn().mockResolvedValue(true),
  createConfirmationAndInvalidatePrior: vi.fn().mockResolvedValue({ confirmationId: "confirmation-new" }),
  getConfirmationForDelivery: vi.fn(),
  markDelivered: vi.fn().mockResolvedValue(undefined),
});

describe("issueConfirmation", () => {
  it("issues a confirmation for a subject that exists", async () => {
    const repository = baseRepository();

    const result = await issueConfirmation(
      { actor: { organizationId: "org-1", staffId: "staff-1" }, subjectType: "measurement_profile", subjectId: "profile-1" },
      repository,
    );

    expect(result.confirmationId).toBe("confirmation-new");
    expect(result.token).toBeTypeOf("string");
    expect(repository.createConfirmationAndInvalidatePrior).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        subjectType: "measurement_profile",
        subjectId: "profile-1",
        createdByStaffId: "staff-1",
      }),
    );
  });

  it("rejects a subject that does not exist without touching the repository", async () => {
    const repository = baseRepository();
    repository.subjectExists.mockResolvedValue(false);

    await expect(
      issueConfirmation(
        { actor: { organizationId: "org-1", staffId: "staff-1" }, subjectType: "order_detail", subjectId: "order-missing" },
        repository,
      ),
    ).rejects.toThrow("The item to confirm was not found.");
    expect(repository.createConfirmationAndInvalidatePrior).not.toHaveBeenCalled();
  });
});

describe("sendConfirmationEmail / markConfirmationCopied", () => {
  it("sends the email and marks the confirmation delivered when the token matches", async () => {
    const repository = baseRepository();
    const token = "real-token";
    repository.getConfirmationForDelivery.mockResolvedValue({ id: "confirmation-1", tokenHash: hashToken(token) });
    const email = { sendConfirmationEmail: vi.fn().mockResolvedValue(undefined) };

    await sendConfirmationEmail(
      {
        organizationId: "org-1",
        confirmationId: "confirmation-1",
        token,
        actorId: "staff-1",
        recipientEmail: "client@example.com",
        confirmationUrl: "https://example.com/confirm/real-token",
        subjectLabel: "measurements",
        clientName: "Ada",
      },
      repository,
      email,
    );

    expect(email.sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "client@example.com", confirmationUrl: "https://example.com/confirm/real-token" }),
    );
    expect(repository.markDelivered).toHaveBeenCalledWith(expect.objectContaining({ method: "email" }));
  });

  it("rejects a token that does not match the stored hash", async () => {
    const repository = baseRepository();
    repository.getConfirmationForDelivery.mockResolvedValue({ id: "confirmation-1", tokenHash: hashToken("the-real-token") });
    const email = { sendConfirmationEmail: vi.fn() };

    await expect(
      sendConfirmationEmail(
        {
          organizationId: "org-1",
          confirmationId: "confirmation-1",
          token: "a-guessed-token",
          actorId: "staff-1",
          recipientEmail: "client@example.com",
          confirmationUrl: "https://example.com/confirm/a-guessed-token",
          subjectLabel: "measurements",
          clientName: "Ada",
        },
        repository,
        email,
      ),
    ).rejects.toThrow("This confirmation was not found.");
    expect(email.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(repository.markDelivered).not.toHaveBeenCalled();
  });

  it("marks a confirmation copied when the token matches", async () => {
    const repository = baseRepository();
    const token = "real-token";
    repository.getConfirmationForDelivery.mockResolvedValue({ id: "confirmation-1", tokenHash: hashToken(token) });

    await markConfirmationCopied({ organizationId: "org-1", confirmationId: "confirmation-1", token, actorId: "staff-1" }, repository);

    expect(repository.markDelivered).toHaveBeenCalledWith(expect.objectContaining({ method: "copy_link" }));
  });
});
