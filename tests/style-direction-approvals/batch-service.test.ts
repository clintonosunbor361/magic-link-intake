import { describe, expect, it, vi } from "vitest";
import {
  createApprovalBatch,
  listEligibleFilesForBatch,
  markApprovalBatchCopied,
  sendApprovalBatchEmail,
} from "@/lib/style-direction-approvals/batch-service";
import { hashToken } from "@/lib/tokens";

const eligibleFile = (overrides: Partial<{ fileId: string; revisionId: string }> = {}) => ({
  fileId: "file-1",
  revisionId: "revision-1",
  category: "moodboard" as const,
  lookId: null,
  lookName: null,
  ...overrides,
});

const baseRepository = () => ({
  orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
  listEligibleFilesForBatch: vi.fn().mockResolvedValue([eligibleFile()]),
  createBatchWithItemsAndInvalidatePrior: vi.fn().mockResolvedValue({ batchId: "batch-new" }),
  getBatchForDelivery: vi.fn(),
  markDelivered: vi.fn().mockResolvedValue(undefined),
});

describe("listEligibleFilesForBatch", () => {
  it("rejects an Order outside the caller's organization", async () => {
    const repository = baseRepository();
    repository.orderBelongsToOrganization.mockResolvedValue(false);

    await expect(listEligibleFilesForBatch("org-1", "order-from-other-org", repository)).rejects.toThrow(
      "Order was not found.",
    );
    expect(repository.listEligibleFilesForBatch).not.toHaveBeenCalled();
  });

  it("returns the repository's eligible files for a valid Order", async () => {
    const repository = baseRepository();
    const result = await listEligibleFilesForBatch("org-1", "order-1", repository);
    expect(result).toEqual([eligibleFile()]);
  });
});

describe("createApprovalBatch", () => {
  it("creates a batch from a valid selection", async () => {
    const repository = baseRepository();

    const result = await createApprovalBatch(
      { actor: { organizationId: "org-1", staffId: "staff-1" }, orderId: "order-1", fileIds: ["file-1"] },
      repository,
    );

    expect(result.batchId).toBe("batch-new");
    expect(result.token).toBeTypeOf("string");
    expect(repository.createBatchWithItemsAndInvalidatePrior).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        orderId: "order-1",
        createdByStaffId: "staff-1",
        items: [{ fileId: "file-1", revisionId: "revision-1" }],
      }),
    );
  });

  it("rejects an empty selection without touching the repository", async () => {
    const repository = baseRepository();

    await expect(
      createApprovalBatch({ actor: { organizationId: "org-1", staffId: "staff-1" }, orderId: "order-1", fileIds: [] }, repository),
    ).rejects.toThrow("Select at least one file to include in the batch.");
    expect(repository.orderBelongsToOrganization).not.toHaveBeenCalled();
  });

  it("rejects an Order outside the caller's organization", async () => {
    const repository = baseRepository();
    repository.orderBelongsToOrganization.mockResolvedValue(false);

    await expect(
      createApprovalBatch(
        { actor: { organizationId: "org-1", staffId: "staff-1" }, orderId: "order-from-other-org", fileIds: ["file-1"] },
        repository,
      ),
    ).rejects.toThrow("Order was not found.");
    expect(repository.createBatchWithItemsAndInvalidatePrior).not.toHaveBeenCalled();
  });

  it("rejects a file that is no longer eligible", async () => {
    const repository = baseRepository();
    repository.listEligibleFilesForBatch.mockResolvedValue([]);

    await expect(
      createApprovalBatch(
        { actor: { organizationId: "org-1", staffId: "staff-1" }, orderId: "order-1", fileIds: ["file-1"] },
        repository,
      ),
    ).rejects.toThrow("One or more selected files are no longer eligible for approval. Reload and try again.");
    expect(repository.createBatchWithItemsAndInvalidatePrior).not.toHaveBeenCalled();
  });
});

describe("sendApprovalBatchEmail / markApprovalBatchCopied", () => {
  it("sends the email and marks the batch delivered when the token matches", async () => {
    const repository = baseRepository();
    const token = "real-token";
    repository.getBatchForDelivery.mockResolvedValue({ id: "batch-1", tokenHash: hashToken(token) });
    const email = { sendApprovalBatchEmail: vi.fn().mockResolvedValue(undefined) };

    await sendApprovalBatchEmail(
      {
        organizationId: "org-1",
        batchId: "batch-1",
        token,
        actorId: "staff-1",
        recipientEmail: "client@example.com",
        approvalUrl: "https://example.com/approve/real-token",
        orderTitle: "Wedding",
        clientName: "Ada",
      },
      repository,
      email,
    );

    expect(email.sendApprovalBatchEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "client@example.com", approvalUrl: "https://example.com/approve/real-token" }),
    );
    expect(repository.markDelivered).toHaveBeenCalledWith(expect.objectContaining({ method: "email" }));
  });

  it("rejects a token that does not match the stored hash", async () => {
    const repository = baseRepository();
    repository.getBatchForDelivery.mockResolvedValue({ id: "batch-1", tokenHash: hashToken("the-real-token") });
    const email = { sendApprovalBatchEmail: vi.fn() };

    await expect(
      sendApprovalBatchEmail(
        {
          organizationId: "org-1",
          batchId: "batch-1",
          token: "a-guessed-token",
          actorId: "staff-1",
          recipientEmail: "client@example.com",
          approvalUrl: "https://example.com/approve/a-guessed-token",
          orderTitle: "Wedding",
          clientName: "Ada",
        },
        repository,
        email,
      ),
    ).rejects.toThrow("This approval batch was not found.");
    expect(email.sendApprovalBatchEmail).not.toHaveBeenCalled();
    expect(repository.markDelivered).not.toHaveBeenCalled();
  });

  it("marks a batch copied when the token matches", async () => {
    const repository = baseRepository();
    const token = "real-token";
    repository.getBatchForDelivery.mockResolvedValue({ id: "batch-1", tokenHash: hashToken(token) });

    await markApprovalBatchCopied({ organizationId: "org-1", batchId: "batch-1", token, actorId: "staff-1" }, repository);

    expect(repository.markDelivered).toHaveBeenCalledWith(expect.objectContaining({ method: "copy_link" }));
  });
});
