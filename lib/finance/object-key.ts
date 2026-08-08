import { randomUUID } from "node:crypto";

export function buildVendorReceiptObjectKey(input: {
  organizationId: string;
  assignmentId: string;
  extension: string;
}): string {
  return `orgs/${input.organizationId}/vendor-assignments/${input.assignmentId}/receipts/${randomUUID()}.${input.extension}`;
}
