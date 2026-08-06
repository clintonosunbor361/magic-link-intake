import { randomUUID } from "node:crypto";

// Grouped by org/order purely for human browsing in the R2 dashboard — the app never derives
// anything from this path, it just stores whatever key comes back and reads it later.
export function buildStyleDirectionObjectKey(input: {
  organizationId: string;
  orderId: string;
  revisionNumber: number;
  extension: string;
}): string {
  return `orgs/${input.organizationId}/orders/${input.orderId}/style-direction/${input.revisionNumber}-${randomUUID()}.${input.extension}`;
}
