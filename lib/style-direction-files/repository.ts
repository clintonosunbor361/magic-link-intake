import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEntries, looks, orders, styleDirectionFileRevisions, styleDirectionFiles } from "@/db/schema";
import { compressStyleDirectionImage } from "@/lib/storage/image";
import { deleteStyleDirectionObject, putStyleDirectionObject } from "@/lib/storage/r2";
import type { StyleDirectionFileRepository, StyleDirectionStorage } from "@/lib/style-direction-files/file-service";

export function createStyleDirectionFileRepository(): StyleDirectionFileRepository {
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
    async lookBelongsToOrder(organizationId, orderId, lookId) {
      const [row] = await db
        .select({ id: looks.id })
        .from(looks)
        .where(and(eq(looks.organizationId, organizationId), eq(looks.orderId, orderId), eq(looks.id, lookId)))
        .limit(1);
      return !!row;
    },
    async createFileWithFirstRevision(input) {
      return db.transaction(async (tx) => {
        const [file] = await tx
          .insert(styleDirectionFiles)
          .values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            lookId: input.lookId,
            category: input.category,
            requiresClientApproval: input.requiresClientApproval,
            approvalStatus: input.requiresClientApproval ? "pending" : null,
          })
          .returning({ id: styleDirectionFiles.id });

        const [revision] = await tx
          .insert(styleDirectionFileRevisions)
          .values({
            organizationId: input.organizationId,
            styleDirectionFileId: file.id,
            revisionNumber: 1,
            r2ObjectKey: input.r2ObjectKey,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            uploadedByStaffId: input.uploadedByStaffId,
          })
          .returning({ id: styleDirectionFileRevisions.id });

        await tx.update(styleDirectionFiles).set({ currentRevisionId: revision.id }).where(eq(styleDirectionFiles.id, file.id));

        return { fileId: file.id, revisionId: revision.id };
      });
    },
    async getFileForRevision(organizationId, fileId) {
      const [row] = await db
        .select({
          id: styleDirectionFiles.id,
          orderId: styleDirectionFiles.orderId,
          version: styleDirectionFiles.version,
          archivedAt: styleDirectionFiles.archivedAt,
          requiresClientApproval: styleDirectionFiles.requiresClientApproval,
          currentRevisionNumber: styleDirectionFileRevisions.revisionNumber,
        })
        .from(styleDirectionFiles)
        .leftJoin(styleDirectionFileRevisions, eq(styleDirectionFileRevisions.id, styleDirectionFiles.currentRevisionId))
        .where(and(eq(styleDirectionFiles.organizationId, organizationId), eq(styleDirectionFiles.id, fileId)))
        .limit(1);
      if (!row) return null;
      return { ...row, currentRevisionNumber: row.currentRevisionNumber ?? 0 };
    },
    async addRevision(input) {
      return db.transaction(async (tx) => {
        const [revision] = await tx
          .insert(styleDirectionFileRevisions)
          .values({
            organizationId: input.organizationId,
            styleDirectionFileId: input.fileId,
            revisionNumber: input.revisionNumber,
            r2ObjectKey: input.r2ObjectKey,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            uploadedByStaffId: input.uploadedByStaffId,
          })
          .returning({ id: styleDirectionFileRevisions.id });

        const rows = await tx
          .update(styleDirectionFiles)
          .set({
            currentRevisionId: revision.id,
            approvalStatus: input.resetApprovalToPending ? "pending" : sql`approval_status`,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(styleDirectionFiles.organizationId, input.organizationId),
              eq(styleDirectionFiles.id, input.fileId),
              eq(styleDirectionFiles.version, input.expectedVersion),
            ),
          )
          .returning({ id: styleDirectionFiles.id });
        if (!rows.length) throw new Error("This Style Direction File changed. Reload and try again.");

        return { revisionId: revision.id };
      });
    },
    async getFileLifecycle(organizationId, fileId) {
      const [row] = await db
        .select({ id: styleDirectionFiles.id, version: styleDirectionFiles.version })
        .from(styleDirectionFiles)
        .where(and(eq(styleDirectionFiles.organizationId, organizationId), eq(styleDirectionFiles.id, fileId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(styleDirectionFiles)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(styleDirectionFiles.organizationId, input.organizationId),
            eq(styleDirectionFiles.id, input.fileId),
            eq(styleDirectionFiles.version, input.expectedVersion),
          ),
        )
        .returning({ id: styleDirectionFiles.id });
      if (!rows.length) throw new Error("This Style Direction File changed. Reload and try again.");
    },
    async insertRevisionReplacedAudit(input) {
      await db.insert(auditEntries).values({
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: "style_direction_file.revision_replaced",
        entityType: "style_direction_file",
        entityId: input.fileId,
        summary: `Uploaded revision ${input.revisionNumber}, replacing the previous Style Direction File revision.`,
        metadata: { revisionId: input.revisionId, revisionNumber: input.revisionNumber },
      });
    },
  };
}

export function createStyleDirectionStorage(): StyleDirectionStorage {
  return {
    putObject: putStyleDirectionObject,
    deleteObject: deleteStyleDirectionObject,
    compressImage: compressStyleDirectionImage,
  };
}

export async function listStyleDirectionFilesForOrder(organizationId: string, orderId: string) {
  const db = getDatabase();

  return db
    .select({
      id: styleDirectionFiles.id,
      lookId: styleDirectionFiles.lookId,
      lookName: looks.name,
      category: styleDirectionFiles.category,
      requiresClientApproval: styleDirectionFiles.requiresClientApproval,
      approvalStatus: styleDirectionFiles.approvalStatus,
      version: styleDirectionFiles.version,
      archivedAt: styleDirectionFiles.archivedAt,
      currentRevisionId: styleDirectionFileRevisions.id,
      currentRevisionNumber: styleDirectionFileRevisions.revisionNumber,
      currentRevisionKey: styleDirectionFileRevisions.r2ObjectKey,
      currentRevisionCreatedAt: styleDirectionFileRevisions.createdAt,
      createdAt: styleDirectionFiles.createdAt,
    })
    .from(styleDirectionFiles)
    .leftJoin(looks, eq(looks.id, styleDirectionFiles.lookId))
    .leftJoin(styleDirectionFileRevisions, eq(styleDirectionFileRevisions.id, styleDirectionFiles.currentRevisionId))
    .where(and(eq(styleDirectionFiles.organizationId, organizationId), eq(styleDirectionFiles.orderId, orderId)))
    .orderBy(desc(styleDirectionFiles.createdAt));
}

export async function listStyleDirectionFileRevisionsForFiles(organizationId: string, fileIds: string[]) {
  if (!fileIds.length) return [];
  const db = getDatabase();
  return db
    .select({
      id: styleDirectionFileRevisions.id,
      styleDirectionFileId: styleDirectionFileRevisions.styleDirectionFileId,
      revisionNumber: styleDirectionFileRevisions.revisionNumber,
      r2ObjectKey: styleDirectionFileRevisions.r2ObjectKey,
      createdAt: styleDirectionFileRevisions.createdAt,
    })
    .from(styleDirectionFileRevisions)
    .where(
      and(
        eq(styleDirectionFileRevisions.organizationId, organizationId),
        inArray(styleDirectionFileRevisions.styleDirectionFileId, fileIds),
      ),
    )
    .orderBy(desc(styleDirectionFileRevisions.revisionNumber));
}
