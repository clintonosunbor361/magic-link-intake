import { randomUUID } from "node:crypto";

export function buildMeasurementAttachmentObjectKey(input: {
  organizationId: string;
  measurementProfileId: string;
  extension: string;
}): string {
  return `orgs/${input.organizationId}/measurement-profiles/${input.measurementProfileId}/${randomUUID()}.${input.extension}`;
}
