import { assertCanManageFinance, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

// Client and Vendor payments differ in what they hang off and whether they carry a receipt, but the
// rules are identical: amounts are positive integer minor units, records are never mutated into
// nonexistence, and every mutation is audited. Both sides share the validation below.

export type PaymentRecord = { id: string; version: number; voidedAt: Date | null };

export type PaymentInput = { amountMinor: number; paidOn: string; reference: string };

export function assertValidPayment(input: PaymentInput): void {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Enter a payment amount greater than zero.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) throw new Error("Enter a valid payment date.");
}

export type ClientPaymentRepository = {
  getInvoiceForPayment(
    organizationId: string,
    invoiceId: string,
  ): Promise<{ id: string; orderId: string; status: string } | null>;
  createPayment(input: {
    organizationId: string;
    invoiceId: string;
    amountMinor: number;
    paidOn: string;
    reference: string;
    actorStaffId: string;
  }): Promise<{ id: string }>;
  getPayment(organizationId: string, paymentId: string): Promise<PaymentRecord | null>;
  updatePayment(input: {
    organizationId: string;
    paymentId: string;
    expectedVersion: number;
    nextVersion: number;
    amountMinor: number;
    paidOn: string;
    reference: string;
    actorStaffId: string;
  }): Promise<void>;
  voidPayment(input: {
    organizationId: string;
    paymentId: string;
    expectedVersion: number;
    nextVersion: number;
    reason: string;
    actorStaffId: string;
  }): Promise<void>;
};

export async function recordClientPayment(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    invoiceId: string;
    payment: PaymentInput;
  },
  repository: ClientPaymentRepository,
) {
  assertCanManageFinance(input.actor.role);
  assertValidPayment(input.payment);

  const invoice = await repository.getInvoiceForPayment(input.organizationId, input.invoiceId);
  if (!invoice) throw new Error("Invoice was not found.");

  // A payment against a Draft or voided Invoice is recorded, not refused: the money arrived, and
  // detectPaymentMismatches surfaces the discrepancy for someone to resolve.
  return repository.createPayment({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    amountMinor: input.payment.amountMinor,
    paidOn: input.payment.paidOn,
    reference: input.payment.reference.trim(),
    actorStaffId: input.actor.staffId,
  });
}

export async function editClientPayment(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    paymentId: string;
    expectedVersion: number;
    payment: PaymentInput;
  },
  repository: ClientPaymentRepository,
) {
  assertCanManageFinance(input.actor.role);
  assertValidPayment(input.payment);

  let existing: PaymentRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      existing = await repository.getPayment(input.organizationId, input.paymentId);
      return existing;
    },
    notFoundMessage: "Payment was not found.",
    staleMessage: "This payment changed. Reload and try again.",
    persist: (nextVersion) => {
      if ((existing as PaymentRecord).voidedAt) throw new Error("A voided payment cannot be edited.");
      return repository.updatePayment({
        organizationId: input.organizationId,
        paymentId: input.paymentId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        amountMinor: input.payment.amountMinor,
        paidOn: input.payment.paidOn,
        reference: input.payment.reference.trim(),
        actorStaffId: input.actor.staffId,
      });
    },
  });
}

/**
 * The delete half of ticket 28's "create/edit/delete", implemented as a void. Payments are immutable
 * evidence under the Milestone 0 lifecycle policy: the row stays, stops counting toward the balance,
 * and keeps the reason it stopped.
 */
export async function voidClientPayment(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    paymentId: string;
    expectedVersion: number;
    reason: string;
  },
  repository: ClientPaymentRepository,
) {
  assertCanManageFinance(input.actor.role);
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to void a payment.");

  let existing: PaymentRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      existing = await repository.getPayment(input.organizationId, input.paymentId);
      return existing;
    },
    notFoundMessage: "Payment was not found.",
    staleMessage: "This payment changed. Reload and try again.",
    persist: (nextVersion) => {
      if ((existing as PaymentRecord).voidedAt) throw new Error("This payment is already void.");
      return repository.voidPayment({
        organizationId: input.organizationId,
        paymentId: input.paymentId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        reason,
        actorStaffId: input.actor.staffId,
      });
    },
  });
}

export type VendorPaymentReceipt = { buffer: Buffer; declaredMimeType: string };

export type VendorPaymentRepository = {
  assignmentBelongsToOrganization(organizationId: string, assignmentId: string): Promise<boolean>;
  createPayment(input: {
    organizationId: string;
    assignmentId: string;
    amountMinor: number;
    paidOn: string;
    reference: string;
    receipt: { objectKey: string; mimeType: string; byteSize: number } | null;
    actorStaffId: string;
  }): Promise<{ id: string }>;
  getPayment(organizationId: string, paymentId: string): Promise<PaymentRecord | null>;
  voidPayment(input: {
    organizationId: string;
    paymentId: string;
    expectedVersion: number;
    nextVersion: number;
    reason: string;
    actorStaffId: string;
  }): Promise<void>;
};

export type VendorPaymentStorage = {
  putObject: (key: string, buffer: Buffer, contentType: string) => Promise<void>;
  deleteObject: (key: string) => Promise<void>;
  buildObjectKey: (input: { organizationId: string; assignmentId: string; extension: string }) => string;
};

export const ALLOWED_RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const RECEIPT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function assertValidReceipt(receipt: VendorPaymentReceipt): void {
  if (receipt.buffer.byteLength > MAX_RECEIPT_BYTES) {
    throw new Error("Receipt is too large. The maximum size is 10MB.");
  }
  if (!ALLOWED_RECEIPT_MIME_TYPES.includes(receipt.declaredMimeType)) {
    throw new Error("Unsupported receipt type. Upload a JPEG, PNG, WebP, or PDF.");
  }
}

/**
 * The receipt is uploaded before the row exists, so a failed insert would otherwise leave an orphan
 * object in R2 — the same put-then-clean-up shape as Style Direction uploads.
 */
export async function recordVendorPayment(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    assignmentId: string;
    payment: PaymentInput;
    receipt: VendorPaymentReceipt | null;
  },
  repository: VendorPaymentRepository,
  storage: VendorPaymentStorage,
) {
  assertCanManageFinance(input.actor.role);
  assertValidPayment(input.payment);
  if (input.receipt) assertValidReceipt(input.receipt);

  if (!(await repository.assignmentBelongsToOrganization(input.organizationId, input.assignmentId))) {
    throw new Error("Vendor assignment was not found.");
  }

  let uploadedKey: string | null = null;
  if (input.receipt) {
    uploadedKey = storage.buildObjectKey({
      organizationId: input.organizationId,
      assignmentId: input.assignmentId,
      extension: RECEIPT_EXTENSIONS[input.receipt.declaredMimeType],
    });
    await storage.putObject(uploadedKey, input.receipt.buffer, input.receipt.declaredMimeType);
  }

  try {
    return await repository.createPayment({
      organizationId: input.organizationId,
      assignmentId: input.assignmentId,
      amountMinor: input.payment.amountMinor,
      paidOn: input.payment.paidOn,
      reference: input.payment.reference.trim(),
      receipt:
        input.receipt && uploadedKey
          ? {
              objectKey: uploadedKey,
              mimeType: input.receipt.declaredMimeType,
              byteSize: input.receipt.buffer.byteLength,
            }
          : null,
      actorStaffId: input.actor.staffId,
    });
  } catch (error) {
    if (uploadedKey) await storage.deleteObject(uploadedKey);
    throw error;
  }
}

export async function voidVendorPayment(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    paymentId: string;
    expectedVersion: number;
    reason: string;
  },
  repository: VendorPaymentRepository,
) {
  assertCanManageFinance(input.actor.role);
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to void a payment.");

  let existing: PaymentRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      existing = await repository.getPayment(input.organizationId, input.paymentId);
      return existing;
    },
    notFoundMessage: "Payment was not found.",
    staleMessage: "This payment changed. Reload and try again.",
    persist: (nextVersion) => {
      if ((existing as PaymentRecord).voidedAt) throw new Error("This payment is already void.");
      return repository.voidPayment({
        organizationId: input.organizationId,
        paymentId: input.paymentId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        reason,
        actorStaffId: input.actor.staffId,
      });
    },
  });
}
