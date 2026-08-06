import { generateToken, hashToken } from "@/lib/tokens";
import type { StyleDirectionFileCategory } from "@/lib/style-direction-files/file-service";

const BATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type EligibleApprovalFile = {
  fileId: string;
  revisionId: string;
  category: StyleDirectionFileCategory;
  lookId: string | null;
  lookName: string | null;
};

export type ApprovalBatchForDelivery = { id: string; tokenHash: string };

export type StyleDirectionApprovalRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  listEligibleFilesForBatch(organizationId: string, orderId: string): Promise<EligibleApprovalFile[]>;
  createBatchWithItemsAndInvalidatePrior(input: {
    organizationId: string;
    orderId: string;
    createdByStaffId: string;
    tokenHash: string;
    expiresAt: Date;
    items: { fileId: string; revisionId: string }[];
  }): Promise<{ batchId: string }>;
  getBatchForDelivery(organizationId: string, batchId: string): Promise<ApprovalBatchForDelivery | null>;
  markDelivered(input: {
    organizationId: string;
    batchId: string;
    actorId: string;
    method: "email" | "copy_link";
    recipientEmail?: string;
  }): Promise<void>;
};

export type ApprovalEmailSender = {
  sendApprovalBatchEmail(input: { to: string; approvalUrl: string; orderTitle: string; clientName: string }): Promise<void>;
};

export async function listEligibleFilesForBatch(
  organizationId: string,
  orderId: string,
  repository: StyleDirectionApprovalRepository,
) {
  const orderOk = await repository.orderBelongsToOrganization(organizationId, orderId);
  if (!orderOk) throw new Error("Order was not found.");
  return repository.listEligibleFilesForBatch(organizationId, orderId);
}

export async function createApprovalBatch(
  input: { actor: { organizationId: string; staffId: string }; orderId: string; fileIds: string[] },
  repository: StyleDirectionApprovalRepository,
) {
  if (!input.fileIds.length) throw new Error("Select at least one file to include in the batch.");

  const orderOk = await repository.orderBelongsToOrganization(input.actor.organizationId, input.orderId);
  if (!orderOk) throw new Error("Order was not found.");

  const eligible = await repository.listEligibleFilesForBatch(input.actor.organizationId, input.orderId);
  const eligibleByFileId = new Map(eligible.map((file) => [file.fileId, file]));

  const items = input.fileIds.map((fileId) => {
    const match = eligibleByFileId.get(fileId);
    if (!match) {
      throw new Error("One or more selected files are no longer eligible for approval. Reload and try again.");
    }
    return { fileId: match.fileId, revisionId: match.revisionId };
  });

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + BATCH_TTL_MS);

  const { batchId } = await repository.createBatchWithItemsAndInvalidatePrior({
    organizationId: input.actor.organizationId,
    orderId: input.orderId,
    createdByStaffId: input.actor.staffId,
    tokenHash,
    expiresAt,
    items,
  });

  return { batchId, token, expiresAt };
}

async function requireBatchForDelivery(
  organizationId: string,
  batchId: string,
  token: string,
  repository: StyleDirectionApprovalRepository,
) {
  const batch = await repository.getBatchForDelivery(organizationId, batchId);
  // Re-verifying the hash (not just the batch ID) proves the caller actually holds the secret
  // token, not just its database ID — the ID alone is guessable/enumerable by any staff member.
  if (!batch || batch.tokenHash !== hashToken(token)) throw new Error("This approval batch was not found.");
  return batch;
}

export async function sendApprovalBatchEmail(
  input: {
    organizationId: string;
    batchId: string;
    token: string;
    actorId: string;
    recipientEmail: string;
    approvalUrl: string;
    orderTitle: string;
    clientName: string;
  },
  repository: StyleDirectionApprovalRepository,
  email: ApprovalEmailSender,
) {
  await requireBatchForDelivery(input.organizationId, input.batchId, input.token, repository);

  await email.sendApprovalBatchEmail({
    to: input.recipientEmail,
    approvalUrl: input.approvalUrl,
    orderTitle: input.orderTitle,
    clientName: input.clientName,
  });

  await repository.markDelivered({
    organizationId: input.organizationId,
    batchId: input.batchId,
    actorId: input.actorId,
    method: "email",
    recipientEmail: input.recipientEmail,
  });
}

export async function markApprovalBatchCopied(
  input: { organizationId: string; batchId: string; token: string; actorId: string },
  repository: StyleDirectionApprovalRepository,
) {
  await requireBatchForDelivery(input.organizationId, input.batchId, input.token, repository);

  await repository.markDelivered({
    organizationId: input.organizationId,
    batchId: input.batchId,
    actorId: input.actorId,
    method: "copy_link",
  });
}
