import "server-only";

import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  clients,
  looks,
  orders,
  styleDirectionApprovalBatchItems,
  styleDirectionApprovalBatches,
  styleDirectionFileRevisions,
  styleDirectionFiles,
} from "@/db/schema";
import { hashToken } from "@/lib/tokens";
import type { EligibleApprovalFile, StyleDirectionApprovalRepository } from "@/lib/style-direction-approvals/batch-service";
import type { ApprovalDecision, StyleDirectionDecisionRepository } from "@/lib/style-direction-approvals/decision-service";

export function createStyleDirectionApprovalRepository(): StyleDirectionApprovalRepository {
  const db = getDatabase();
  return {
    async orderBelongsToOrganization(organizationId, orderId) {
      const [row] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
        .limit(1);
      return !!row;
    },
    async listEligibleFilesForBatch(organizationId, orderId) {
      const rows = await db
        .select({
          fileId: styleDirectionFiles.id,
          revisionId: styleDirectionFiles.currentRevisionId,
          category: styleDirectionFiles.category,
          lookId: styleDirectionFiles.lookId,
          lookName: looks.name,
        })
        .from(styleDirectionFiles)
        .leftJoin(looks, eq(looks.id, styleDirectionFiles.lookId))
        .where(
          and(
            eq(styleDirectionFiles.organizationId, organizationId),
            eq(styleDirectionFiles.orderId, orderId),
            eq(styleDirectionFiles.requiresClientApproval, true),
            isNull(styleDirectionFiles.archivedAt),
            eq(styleDirectionFiles.approvalStatus, "pending"),
          ),
        );
      // requiresClientApproval + approvalStatus="pending" always implies a current revision exists
      // (set atomically when the file/first revision is created) — the null-check is just for TS.
      return rows.filter((row): row is EligibleApprovalFile => row.revisionId !== null);
    },
    async createBatchWithItemsAndInvalidatePrior(input) {
      return db.transaction(async (tx) => {
        const revisionIds = input.items.map((item) => item.revisionId);
        const overlapping = await tx
          .selectDistinct({ id: styleDirectionApprovalBatches.id })
          .from(styleDirectionApprovalBatches)
          .innerJoin(
            styleDirectionApprovalBatchItems,
            eq(styleDirectionApprovalBatchItems.batchId, styleDirectionApprovalBatches.id),
          )
          .where(
            and(
              eq(styleDirectionApprovalBatches.orderId, input.orderId),
              isNull(styleDirectionApprovalBatches.supersededAt),
              isNull(styleDirectionApprovalBatches.completedAt),
              gt(styleDirectionApprovalBatches.expiresAt, new Date()),
              inArray(styleDirectionApprovalBatchItems.styleDirectionFileRevisionId, revisionIds),
            ),
          );

        if (overlapping.length) {
          // The completedAt IS NULL guard means a batch that raced to completion between the
          // SELECT above and this UPDATE wins over supersession — the client keeps their decision
          // summary instead of the link going dead out from under them.
          await tx
            .update(styleDirectionApprovalBatches)
            .set({ supersededAt: new Date() })
            .where(
              and(
                inArray(styleDirectionApprovalBatches.id, overlapping.map((batch) => batch.id)),
                isNull(styleDirectionApprovalBatches.completedAt),
              ),
            );
        }

        const [batch] = await tx
          .insert(styleDirectionApprovalBatches)
          .values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            tokenHash: input.tokenHash,
            createdByStaffId: input.createdByStaffId,
            expiresAt: input.expiresAt,
          })
          .returning({ id: styleDirectionApprovalBatches.id });

        await tx.insert(styleDirectionApprovalBatchItems).values(
          input.items.map((item) => ({
            organizationId: input.organizationId,
            batchId: batch.id,
            styleDirectionFileId: item.fileId,
            styleDirectionFileRevisionId: item.revisionId,
          })),
        );

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.createdByStaffId,
          action: "style_direction_approval_batch.created",
          entityType: "style_direction_approval_batch",
          entityId: batch.id,
          summary: `Created an approval batch with ${input.items.length} file${input.items.length === 1 ? "" : "s"}.`,
          metadata: { orderId: input.orderId, fileIds: input.items.map((item) => item.fileId) },
        });

        return { batchId: batch.id };
      });
    },
    async getBatchForDelivery(organizationId, batchId) {
      const [row] = await db
        .select({ id: styleDirectionApprovalBatches.id, tokenHash: styleDirectionApprovalBatches.tokenHash })
        .from(styleDirectionApprovalBatches)
        .where(and(eq(styleDirectionApprovalBatches.organizationId, organizationId), eq(styleDirectionApprovalBatches.id, batchId)))
        .limit(1);
      return row ?? null;
    },
    async markDelivered(input) {
      await db.transaction(async (tx) => {
        await tx
          .update(styleDirectionApprovalBatches)
          .set({ deliveryMethod: input.method, deliveredAt: new Date() })
          .where(
            and(
              eq(styleDirectionApprovalBatches.organizationId, input.organizationId),
              eq(styleDirectionApprovalBatches.id, input.batchId),
            ),
          );

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "style_direction_approval_batch.sent",
          entityType: "style_direction_approval_batch",
          entityId: input.batchId,
          summary:
            input.method === "email"
              ? `Sent the approval batch by email to ${input.recipientEmail}.`
              : "Copied the approval batch link.",
          metadata: input.method === "email" ? { method: input.method, recipientEmail: input.recipientEmail } : { method: input.method },
        });
      });
    },
  };
}

export async function listApprovalBatchesForOrder(organizationId: string, orderId: string) {
  const db = getDatabase();
  const rows = await db
    .select({
      id: styleDirectionApprovalBatches.id,
      expiresAt: styleDirectionApprovalBatches.expiresAt,
      completedAt: styleDirectionApprovalBatches.completedAt,
      supersededAt: styleDirectionApprovalBatches.supersededAt,
      deliveryMethod: styleDirectionApprovalBatches.deliveryMethod,
      deliveredAt: styleDirectionApprovalBatches.deliveredAt,
      createdAt: styleDirectionApprovalBatches.createdAt,
    })
    .from(styleDirectionApprovalBatches)
    .where(and(eq(styleDirectionApprovalBatches.organizationId, organizationId), eq(styleDirectionApprovalBatches.orderId, orderId)))
    .orderBy(styleDirectionApprovalBatches.createdAt);

  return rows.map((row) => ({ ...row, status: getApprovalBatchStatus(row) }));
}

export type ApprovalBatchStatus = "Active" | "Completed" | "Superseded" | "Expired";

export function getApprovalBatchStatus(
  batch: { completedAt: Date | null; supersededAt: Date | null; expiresAt: Date },
  now = new Date(),
): ApprovalBatchStatus {
  if (batch.completedAt) return "Completed";
  if (batch.supersededAt) return "Superseded";
  if (batch.expiresAt <= now) return "Expired";
  return "Active";
}

function auditActionForDecision(decision: ApprovalDecision): string {
  if (decision === "approved") return "style_direction_approval.approved";
  if (decision === "rejected") return "style_direction_approval.rejected";
  return "style_direction_approval.revisions_requested";
}

export function createStyleDirectionDecisionRepository(): StyleDirectionDecisionRepository {
  const db = getDatabase();
  return {
    async applyDecisionAndMaybeComplete(input) {
      return db.transaction(async (tx) => {
        const [batch] = await tx
          .select({
            id: styleDirectionApprovalBatches.id,
            organizationId: styleDirectionApprovalBatches.organizationId,
            expiresAt: styleDirectionApprovalBatches.expiresAt,
            supersededAt: styleDirectionApprovalBatches.supersededAt,
          })
          .from(styleDirectionApprovalBatches)
          .where(eq(styleDirectionApprovalBatches.tokenHash, input.tokenHash))
          .for("update");

        if (!batch || batch.supersededAt || batch.expiresAt <= new Date()) {
          return { ok: false as const, reason: "inactive" as const };
        }

        // No separate completedAt check needed: once a batch is complete, every item's
        // decisionStatus is already non-pending, so the guarded UPDATE below naturally returns 0
        // rows for a resubmission and falls through to the same "inactive" result.
        const [item] = await tx
          .update(styleDirectionApprovalBatchItems)
          .set({ decisionStatus: input.decision, decisionComment: input.comment, decidedAt: new Date() })
          .where(
            and(
              eq(styleDirectionApprovalBatchItems.id, input.batchItemId),
              eq(styleDirectionApprovalBatchItems.batchId, batch.id),
              eq(styleDirectionApprovalBatchItems.decisionStatus, "pending"),
            ),
          )
          .returning({
            id: styleDirectionApprovalBatchItems.id,
            styleDirectionFileId: styleDirectionApprovalBatchItems.styleDirectionFileId,
            styleDirectionFileRevisionId: styleDirectionApprovalBatchItems.styleDirectionFileRevisionId,
          });

        if (!item) return { ok: false as const, reason: "inactive" as const };

        // Stale-revision guard: only cascade onto the File's status if the decided revision is
        // still current — a new revision uploaded mid-flight must not let a decision on content
        // the client never saw silently stamp status onto what replaced it.
        await tx
          .update(styleDirectionFiles)
          .set({ approvalStatus: input.decision })
          .where(
            and(
              eq(styleDirectionFiles.id, item.styleDirectionFileId),
              eq(styleDirectionFiles.currentRevisionId, item.styleDirectionFileRevisionId),
            ),
          );

        const [remainingPending] = await tx
          .select({ id: styleDirectionApprovalBatchItems.id })
          .from(styleDirectionApprovalBatchItems)
          .where(
            and(
              eq(styleDirectionApprovalBatchItems.batchId, batch.id),
              eq(styleDirectionApprovalBatchItems.decisionStatus, "pending"),
            ),
          )
          .limit(1);

        if (!remainingPending) {
          await tx.update(styleDirectionApprovalBatches).set({ completedAt: new Date() }).where(eq(styleDirectionApprovalBatches.id, batch.id));
        }

        await tx.insert(auditEntries).values({
          organizationId: batch.organizationId,
          actorId: null,
          action: auditActionForDecision(input.decision),
          entityType: "style_direction_file_revision",
          entityId: item.styleDirectionFileRevisionId,
          summary: `A client ${input.decision === "approved" ? "approved" : input.decision === "rejected" ? "rejected" : "requested revisions on"} a Style Direction File.`,
          metadata: { batchId: batch.id, fileId: item.styleDirectionFileId, comment: input.comment },
        });

        return { ok: true as const };
      });
    },
  };
}

export async function listPendingApprovalFiles(organizationId: string, orderId: string) {
  const db = getDatabase();
  const rows = await db
    .select({
      fileId: styleDirectionFiles.id,
      category: styleDirectionFiles.category,
      lookId: styleDirectionFiles.lookId,
      lookName: looks.name,
    })
    .from(styleDirectionFiles)
    .leftJoin(looks, eq(looks.id, styleDirectionFiles.lookId))
    .where(
      and(
        eq(styleDirectionFiles.organizationId, organizationId),
        eq(styleDirectionFiles.orderId, orderId),
        eq(styleDirectionFiles.requiresClientApproval, true),
        eq(styleDirectionFiles.approvalStatus, "pending"),
        isNull(styleDirectionFiles.archivedAt),
      ),
    );
  if (!rows.length) return [];

  const fileIds = rows.map((row) => row.fileId);
  const activeBatchFileIds = new Set(
    (
      await db
        .selectDistinct({ fileId: styleDirectionApprovalBatchItems.styleDirectionFileId })
        .from(styleDirectionApprovalBatchItems)
        .innerJoin(styleDirectionApprovalBatches, eq(styleDirectionApprovalBatches.id, styleDirectionApprovalBatchItems.batchId))
        .where(
          and(
            inArray(styleDirectionApprovalBatchItems.styleDirectionFileId, fileIds),
            eq(styleDirectionApprovalBatchItems.decisionStatus, "pending"),
            isNull(styleDirectionApprovalBatches.completedAt),
            isNull(styleDirectionApprovalBatches.supersededAt),
            gt(styleDirectionApprovalBatches.expiresAt, new Date()),
          ),
        )
    ).map((row) => row.fileId),
  );

  return rows.map((row) => ({ ...row, sentInActiveBatch: activeBatchFileIds.has(row.fileId) }));
}

export async function listRevisionQueueFiles(organizationId: string, orderId: string) {
  const db = getDatabase();
  const files = await db
    .select({
      fileId: styleDirectionFiles.id,
      category: styleDirectionFiles.category,
      lookId: styleDirectionFiles.lookId,
      lookName: looks.name,
      approvalStatus: styleDirectionFiles.approvalStatus,
      currentRevisionId: styleDirectionFiles.currentRevisionId,
    })
    .from(styleDirectionFiles)
    .leftJoin(looks, eq(looks.id, styleDirectionFiles.lookId))
    .where(
      and(
        eq(styleDirectionFiles.organizationId, organizationId),
        eq(styleDirectionFiles.orderId, orderId),
        inArray(styleDirectionFiles.approvalStatus, ["with_revisions", "rejected"]),
        isNull(styleDirectionFiles.archivedAt),
      ),
    );
  if (!files.length) return [];

  const revisionIds = files.map((file) => file.currentRevisionId).filter((id): id is string => Boolean(id));
  const decisions = revisionIds.length
    ? await db
        .select({
          revisionId: styleDirectionApprovalBatchItems.styleDirectionFileRevisionId,
          decisionComment: styleDirectionApprovalBatchItems.decisionComment,
          decidedAt: styleDirectionApprovalBatchItems.decidedAt,
        })
        .from(styleDirectionApprovalBatchItems)
        .where(inArray(styleDirectionApprovalBatchItems.styleDirectionFileRevisionId, revisionIds))
        .orderBy(desc(styleDirectionApprovalBatchItems.decidedAt))
    : [];
  const decisionByRevisionId = new Map(decisions.map((decision) => [decision.revisionId, decision]));

  return files.map((file) => {
    const decision = file.currentRevisionId ? decisionByRevisionId.get(file.currentRevisionId) : undefined;
    return {
      fileId: file.fileId,
      category: file.category,
      lookId: file.lookId,
      lookName: file.lookName,
      approvalStatus: file.approvalStatus as "with_revisions" | "rejected",
      decisionComment: decision?.decisionComment ?? null,
      decidedAt: decision?.decidedAt ?? null,
    };
  });
}

export type ApprovalBatchViewItem = {
  id: string;
  fileId: string;
  category: string;
  lookId: string | null;
  lookName: string | null;
  decisionStatus: string;
  decisionComment: string | null;
  r2ObjectKey: string;
};

export type ApprovalBatchView = {
  id: string;
  orderId: string;
  orderTitle: string;
  clientFullName: string;
  status: ApprovalBatchStatus;
  items: ApprovalBatchViewItem[];
};

// No organizationId scoping — the token itself is the credential here (this page is reached by
// an unauthenticated client, not a signed-in staff session).
export async function getApprovalBatchForToken(token: string): Promise<ApprovalBatchView | null> {
  const db = getDatabase();
  const [batch] = await db
    .select({
      id: styleDirectionApprovalBatches.id,
      orderId: styleDirectionApprovalBatches.orderId,
      completedAt: styleDirectionApprovalBatches.completedAt,
      supersededAt: styleDirectionApprovalBatches.supersededAt,
      expiresAt: styleDirectionApprovalBatches.expiresAt,
    })
    .from(styleDirectionApprovalBatches)
    .where(eq(styleDirectionApprovalBatches.tokenHash, hashToken(token)))
    .limit(1);
  if (!batch) return null;

  const [order] = await db
    .select({ title: orders.title, clientFullName: clients.fullName })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(eq(orders.id, batch.orderId))
    .limit(1);

  const items = await db
    .select({
      id: styleDirectionApprovalBatchItems.id,
      fileId: styleDirectionApprovalBatchItems.styleDirectionFileId,
      category: styleDirectionFiles.category,
      lookId: styleDirectionFiles.lookId,
      lookName: looks.name,
      decisionStatus: styleDirectionApprovalBatchItems.decisionStatus,
      decisionComment: styleDirectionApprovalBatchItems.decisionComment,
      r2ObjectKey: styleDirectionFileRevisions.r2ObjectKey,
    })
    .from(styleDirectionApprovalBatchItems)
    .innerJoin(styleDirectionFiles, eq(styleDirectionFiles.id, styleDirectionApprovalBatchItems.styleDirectionFileId))
    .leftJoin(looks, eq(looks.id, styleDirectionFiles.lookId))
    .innerJoin(
      styleDirectionFileRevisions,
      eq(styleDirectionFileRevisions.id, styleDirectionApprovalBatchItems.styleDirectionFileRevisionId),
    )
    .where(eq(styleDirectionApprovalBatchItems.batchId, batch.id));

  return {
    id: batch.id,
    orderId: batch.orderId,
    orderTitle: order?.title ?? "",
    clientFullName: order?.clientFullName ?? "",
    status: getApprovalBatchStatus(batch),
    items,
  };
}
