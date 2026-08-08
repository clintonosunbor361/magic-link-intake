import { assertCanManageFinance, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import {
  assertLineItemsEditable,
  assertSendable,
  assertValidLineItem,
  assertVoidable,
  type InvoiceLifecycleStatus,
  type InvoiceLineItemInput,
} from "@/lib/finance/invoice";

export type InvoiceRecord = {
  id: string;
  orderId: string;
  status: InvoiceLifecycleStatus;
  version: number;
};

export type InvoiceRepository = {
  orderBelongsToOrganization(organizationId: string, orderId: string): Promise<boolean>;
  getInvoiceByOrder(organizationId: string, orderId: string): Promise<InvoiceRecord | null>;
  getInvoice(organizationId: string, invoiceId: string): Promise<InvoiceRecord | null>;
  countLineItems(organizationId: string, invoiceId: string): Promise<number>;
  createInvoice(input: {
    organizationId: string;
    orderId: string;
    issueDate: string;
    dueDate: string | null;
    notes: string;
    paymentInstructions: string;
    actorStaffId: string;
    lines: InvoiceLineItemInput[];
  }): Promise<{ id: string; sequence: number }>;
  replaceLineItems(input: {
    organizationId: string;
    invoiceId: string;
    expectedVersion: number;
    nextVersion: number;
    issueDate: string;
    dueDate: string | null;
    notes: string;
    paymentInstructions: string;
    lines: InvoiceLineItemInput[];
  }): Promise<void>;
  markSent(input: {
    organizationId: string;
    invoiceId: string;
    expectedVersion: number;
    nextVersion: number;
    sentAt: Date;
    actorStaffId: string;
  }): Promise<void>;
  markVoid(input: {
    organizationId: string;
    invoiceId: string;
    expectedVersion: number;
    nextVersion: number;
    voidedAt: Date;
    reason: string;
    actorStaffId: string;
  }): Promise<void>;
};

function normalizeLines(lines: InvoiceLineItemInput[]): InvoiceLineItemInput[] {
  if (!lines.length) throw new Error("An Invoice needs at least one line item.");
  const normalized = lines.map((line) => ({ ...line, description: line.description.trim() }));
  normalized.forEach(assertValidLineItem);
  return normalized;
}

/**
 * One Order has one Invoice in Phase 1. The unique index on order_id is what actually enforces
 * that; this check exists to turn the database error into a sentence a person can act on.
 */
export async function createOrderInvoice(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    orderId: string;
    issueDate: string;
    dueDate: string | null;
    notes: string;
    paymentInstructions: string;
    lines: InvoiceLineItemInput[];
  },
  repository: InvoiceRepository,
) {
  assertCanManageFinance(input.actor.role);

  if (!(await repository.orderBelongsToOrganization(input.organizationId, input.orderId))) {
    throw new Error("Order was not found.");
  }

  const existing = await repository.getInvoiceByOrder(input.organizationId, input.orderId);
  if (existing) throw new Error("This Order already has an Invoice. Phase 1 allows one per Order.");

  return repository.createInvoice({
    organizationId: input.organizationId,
    orderId: input.orderId,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    paymentInstructions: input.paymentInstructions.trim(),
    actorStaffId: input.actor.staffId,
    lines: normalizeLines(input.lines),
  });
}

export async function updateDraftInvoice(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    invoiceId: string;
    expectedVersion: number;
    issueDate: string;
    dueDate: string | null;
    notes: string;
    paymentInstructions: string;
    lines: InvoiceLineItemInput[];
  },
  repository: InvoiceRepository,
) {
  assertCanManageFinance(input.actor.role);
  const lines = normalizeLines(input.lines);

  let invoice: InvoiceRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      invoice = await repository.getInvoice(input.organizationId, input.invoiceId);
      return invoice;
    },
    notFoundMessage: "Invoice was not found.",
    staleMessage: "This Invoice changed. Reload and try again.",
    persist: (nextVersion) => {
      assertLineItemsEditable((invoice as InvoiceRecord).status);
      return repository.replaceLineItems({
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        notes: input.notes.trim(),
        paymentInstructions: input.paymentInstructions.trim(),
        lines,
      });
    },
  });
}

/**
 * Sending is the same act as producing the PDF — see the route in app/api/invoices. This decides
 * whether the transition is allowed; the route writes it in the same call that streams the bytes.
 */
export async function markInvoiceSent(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    invoiceId: string;
    expectedVersion: number;
    sentAt?: Date;
  },
  repository: InvoiceRepository,
) {
  assertCanManageFinance(input.actor.role);

  let invoice: InvoiceRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      invoice = await repository.getInvoice(input.organizationId, input.invoiceId);
      return invoice;
    },
    notFoundMessage: "Invoice was not found.",
    staleMessage: "This Invoice changed. Reload and try again.",
    persist: async (nextVersion) => {
      const current = invoice as InvoiceRecord;
      const lineCount = await repository.countLineItems(input.organizationId, input.invoiceId);
      assertSendable(current.status, lineCount);

      await repository.markSent({
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        sentAt: input.sentAt ?? new Date(),
        actorStaffId: input.actor.staffId,
      });
    },
  });
}

export async function voidInvoice(
  input: {
    actor: { role: StaffRole; staffId: string };
    organizationId: string;
    invoiceId: string;
    expectedVersion: number;
    reason: string;
  },
  repository: InvoiceRepository,
) {
  assertCanManageFinance(input.actor.role);

  let invoice: InvoiceRecord | null = null;
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => {
      invoice = await repository.getInvoice(input.organizationId, input.invoiceId);
      return invoice;
    },
    notFoundMessage: "Invoice was not found.",
    staleMessage: "This Invoice changed. Reload and try again.",
    persist: (nextVersion) => {
      assertVoidable((invoice as InvoiceRecord).status, input.reason);
      return repository.markVoid({
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        voidedAt: new Date(),
        reason: input.reason.trim(),
        actorStaffId: input.actor.staffId,
      });
    },
  });
}
