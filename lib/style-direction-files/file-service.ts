import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";
import { buildStyleDirectionObjectKey } from "@/lib/style-direction-files/object-key";

export const MAX_ORIGINAL_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const STYLE_DIRECTION_FILE_CATEGORIES = [
  "moodboard",
  "sketch",
  "fabric_reference",
  "colour_reference",
  "other",
] as const;

export type StyleDirectionFileCategory = (typeof STYLE_DIRECTION_FILE_CATEGORIES)[number];

export function formatStyleDirectionLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

export type StyleDirectionFileLifecycleRecord = { id: string; version: number };

export type StyleDirectionFileForRevision = {
  id: string;
  orderId: string;
  version: number;
  archivedAt: Date | null;
  requiresClientApproval: boolean;
  currentRevisionNumber: number;
};

export type StyleDirectionFileRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  lookBelongsToOrder(organizationId: string, orderId: string, lookId: string): Promise<boolean>;
  createFileWithFirstRevision(input: {
    organizationId: string;
    orderId: string;
    lookId: string | null;
    category: StyleDirectionFileCategory;
    requiresClientApproval: boolean;
    r2ObjectKey: string;
    mimeType: string;
    byteSize: number;
    uploadedByStaffId: string;
  }): Promise<{ fileId: string; revisionId: string }>;
  getFileForRevision(organizationId: string, fileId: string): Promise<StyleDirectionFileForRevision | null>;
  addRevision(input: {
    organizationId: string;
    fileId: string;
    expectedVersion: number;
    nextVersion: number;
    revisionNumber: number;
    r2ObjectKey: string;
    mimeType: string;
    byteSize: number;
    uploadedByStaffId: string;
    resetApprovalToPending: boolean;
  }): Promise<{ revisionId: string }>;
  getFileLifecycle(organizationId: string, fileId: string): Promise<StyleDirectionFileLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    fileId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  insertRevisionReplacedAudit(input: {
    organizationId: string;
    actorId: string;
    fileId: string;
    revisionId: string;
    revisionNumber: number;
  }): Promise<void>;
};

export type StyleDirectionStorage = {
  putObject: (key: string, buffer: Buffer, contentType: string) => Promise<void>;
  deleteObject: (key: string) => Promise<void>;
  compressImage: (buffer: Buffer) => Promise<{ buffer: Buffer; mimeType: string; extension: string }>;
};

function assertValidUpload(upload: { buffer: Buffer; declaredMimeType: string }) {
  if (upload.buffer.byteLength === 0) throw new Error("Choose a file to upload.");
  if (upload.buffer.byteLength > MAX_ORIGINAL_UPLOAD_BYTES) {
    throw new Error("File is too large. The maximum upload size is 15MB.");
  }
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(upload.declaredMimeType)) {
    throw new Error("Unsupported file type. Upload a JPEG, PNG, WebP, or HEIC image.");
  }
}

export async function createStyleDirectionFile(
  input: {
    organizationId: string;
    orderId: string;
    lookId: string | null;
    category: StyleDirectionFileCategory;
    requiresClientApproval: boolean;
    uploadedByStaffId: string;
  },
  upload: { buffer: Buffer; declaredMimeType: string },
  repository: StyleDirectionFileRepository,
  storage: StyleDirectionStorage,
) {
  assertValidUpload(upload);

  const orderOk = await repository.orderBelongsToOrganization(input.organizationId, input.orderId);
  if (!orderOk) throw new Error("Order was not found.");
  if (input.lookId) {
    const lookOk = await repository.lookBelongsToOrder(input.organizationId, input.orderId, input.lookId);
    if (!lookOk) throw new Error("Look was not found.");
  }

  const compressed = await storage.compressImage(upload.buffer);
  const key = buildStyleDirectionObjectKey({
    organizationId: input.organizationId,
    orderId: input.orderId,
    revisionNumber: 1,
    extension: compressed.extension,
  });

  await storage.putObject(key, compressed.buffer, compressed.mimeType);

  try {
    return await repository.createFileWithFirstRevision({
      organizationId: input.organizationId,
      orderId: input.orderId,
      lookId: input.lookId,
      category: input.category,
      requiresClientApproval: input.requiresClientApproval,
      r2ObjectKey: key,
      mimeType: compressed.mimeType,
      byteSize: compressed.buffer.byteLength,
      uploadedByStaffId: input.uploadedByStaffId,
    });
  } catch (error) {
    await storage.deleteObject(key);
    throw error;
  }
}

export async function addStyleDirectionFileRevision(
  input: { organizationId: string; fileId: string; expectedVersion: number; uploadedByStaffId: string },
  upload: { buffer: Buffer; declaredMimeType: string },
  repository: StyleDirectionFileRepository,
  storage: StyleDirectionStorage,
) {
  assertValidUpload(upload);

  let file: StyleDirectionFileForRevision | null = null;

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      file = await repository.getFileForRevision(input.organizationId, input.fileId);
      return file;
    },
    notFoundMessage: "Style Direction File was not found.",
    staleMessage: "This Style Direction File changed. Reload and try again.",
    persist: async (nextVersion) => {
      const current = file as StyleDirectionFileForRevision;
      if (current.archivedAt) throw new Error("An archived Style Direction File cannot be revised.");

      const compressed = await storage.compressImage(upload.buffer);
      const nextRevisionNumber = current.currentRevisionNumber + 1;
      const key = buildStyleDirectionObjectKey({
        organizationId: input.organizationId,
        orderId: current.orderId,
        revisionNumber: nextRevisionNumber,
        extension: compressed.extension,
      });

      await storage.putObject(key, compressed.buffer, compressed.mimeType);

      try {
        const { revisionId } = await repository.addRevision({
          organizationId: input.organizationId,
          fileId: input.fileId,
          expectedVersion: input.expectedVersion,
          nextVersion,
          revisionNumber: nextRevisionNumber,
          r2ObjectKey: key,
          mimeType: compressed.mimeType,
          byteSize: compressed.buffer.byteLength,
          uploadedByStaffId: input.uploadedByStaffId,
          resetApprovalToPending: current.requiresClientApproval,
        });
        // Only revision 2+ counts as "replacing" something — the first upload has nothing to replace.
        await repository.insertRevisionReplacedAudit({
          organizationId: input.organizationId,
          actorId: input.uploadedByStaffId,
          fileId: input.fileId,
          revisionId,
          revisionNumber: nextRevisionNumber,
        });
      } catch (error) {
        await storage.deleteObject(key);
        throw error;
      }
    },
  });
}

export async function archiveStyleDirectionFile(
  input: { actor: { organizationId: string; role: StaffRole }; fileId: string; expectedVersion: number },
  repository: StyleDirectionFileRepository,
) {
  if (!mayArchive("style_direction_file", input.actor.role)) {
    throw new Error("You cannot archive this Style Direction File.");
  }
  return setArchivedState(input, true, repository);
}

export async function restoreStyleDirectionFile(
  input: { actor: { organizationId: string; role: StaffRole }; fileId: string; expectedVersion: number },
  repository: StyleDirectionFileRepository,
) {
  if (!mayRestore("style_direction_file", input.actor.role)) {
    throw new Error("You cannot restore this Style Direction File.");
  }
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; fileId: string; expectedVersion: number },
  archived: boolean,
  repository: StyleDirectionFileRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getFileLifecycle(input.actor.organizationId, input.fileId),
    notFoundMessage: "Style Direction File was not found.",
    staleMessage: "This Style Direction File changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        fileId: input.fileId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
