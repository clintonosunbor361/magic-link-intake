import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_ORIGINAL_UPLOAD_BYTES } from "@/lib/style-direction-files/file-service";
import { buildMeasurementAttachmentObjectKey } from "@/lib/measurement-profiles/object-key";

export type MeasurementProfileAttachmentLifecycleRecord = { id: string; version: number };

export type MeasurementProfileAttachmentRepository = {
  measurementProfileBelongsToOrganization(organizationId: string, measurementProfileId: string): Promise<boolean>;
  createAttachment(input: {
    organizationId: string;
    measurementProfileId: string;
    r2ObjectKey: string;
    mimeType: string;
    byteSize: number;
    uploadedByStaffId: string;
  }): Promise<{ id: string }>;
  getAttachmentLifecycle(organizationId: string, attachmentId: string): Promise<MeasurementProfileAttachmentLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    attachmentId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export type MeasurementAttachmentStorage = {
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

export async function createMeasurementProfileAttachment(
  input: { organizationId: string; measurementProfileId: string; uploadedByStaffId: string },
  upload: { buffer: Buffer; declaredMimeType: string },
  repository: MeasurementProfileAttachmentRepository,
  storage: MeasurementAttachmentStorage,
) {
  assertValidUpload(upload);

  const profileOk = await repository.measurementProfileBelongsToOrganization(input.organizationId, input.measurementProfileId);
  if (!profileOk) throw new Error("Measurement profile was not found.");

  const compressed = await storage.compressImage(upload.buffer);
  const key = buildMeasurementAttachmentObjectKey({
    organizationId: input.organizationId,
    measurementProfileId: input.measurementProfileId,
    extension: compressed.extension,
  });

  await storage.putObject(key, compressed.buffer, compressed.mimeType);

  try {
    return await repository.createAttachment({
      organizationId: input.organizationId,
      measurementProfileId: input.measurementProfileId,
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

export async function archiveMeasurementProfileAttachment(
  input: { actor: { organizationId: string; role: StaffRole }; attachmentId: string; expectedVersion: number },
  repository: MeasurementProfileAttachmentRepository,
) {
  if (!mayArchive("measurement_profile_attachment", input.actor.role)) {
    throw new Error("You cannot archive this attachment.");
  }
  return setArchivedState(input, true, repository);
}

export async function restoreMeasurementProfileAttachment(
  input: { actor: { organizationId: string; role: StaffRole }; attachmentId: string; expectedVersion: number },
  repository: MeasurementProfileAttachmentRepository,
) {
  if (!mayRestore("measurement_profile_attachment", input.actor.role)) {
    throw new Error("You cannot restore this attachment.");
  }
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; attachmentId: string; expectedVersion: number },
  archived: boolean,
  repository: MeasurementProfileAttachmentRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getAttachmentLifecycle(input.actor.organizationId, input.attachmentId),
    notFoundMessage: "Attachment was not found.",
    staleMessage: "This attachment changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        attachmentId: input.attachmentId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
