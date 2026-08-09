import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  clientPayments,
  clients,
  invoiceLineItems,
  invoices,
  items,
  itemTypes,
  looks,
  orders,
  staffProfiles,
  vendorAssignments,
  vendorPayments,
  vendors,
} from "@/db/schema";
import { computeOrderBalance, computeVendorPaymentPosition } from "@/lib/finance/balances";
import { computeInvoiceTotalMinor, formatInvoiceNumber, type InvoiceLifecycleStatus } from "@/lib/finance/invoice";
import type { InvoiceRepository } from "@/lib/finance/invoice-service";
import type { ClientPaymentRepository, VendorPaymentRepository, VendorPaymentStorage } from "@/lib/finance/payment-service";
import type { OrderCompletionRepository } from "@/lib/finance/completion-service";
import { buildVendorReceiptObjectKey } from "@/lib/finance/object-key";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage/r2";

export function createInvoiceRepository(): InvoiceRepository {
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
    async getInvoiceByOrder(organizationId, orderId) {
      const [row] = await db
        .select({ id: invoices.id, orderId: invoices.orderId, status: invoices.status, version: invoices.version })
        .from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), eq(invoices.orderId, orderId)))
        .limit(1);
      return row ?? null;
    },
    async getInvoice(organizationId, invoiceId) {
      const [row] = await db
        .select({ id: invoices.id, orderId: invoices.orderId, status: invoices.status, version: invoices.version })
        .from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, invoiceId)))
        .limit(1);
      return row ?? null;
    },
    async countLineItems(organizationId, invoiceId) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoiceLineItems)
        .where(and(eq(invoiceLineItems.organizationId, organizationId), eq(invoiceLineItems.invoiceId, invoiceId)));
      return row?.count ?? 0;
    },
    async createInvoice(input) {
      return db.transaction(async (tx) => {
        // The org-scoped counter is allocated from the existing maximum inside the transaction. The
        // unique index on (organization_id, sequence) is the real guarantee: if two Invoices are
        // created at the same instant, one fails rather than reusing a number.
        const [{ next }] = await tx
          .select({ next: sql<number>`coalesce(max(${invoices.sequence}), 0) + 1` })
          .from(invoices)
          .where(eq(invoices.organizationId, input.organizationId));

        const [invoice] = await tx
          .insert(invoices)
          .values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            sequence: next,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            notes: input.notes,
            paymentInstructions: input.paymentInstructions,
            createdByStaffId: input.actorStaffId,
          })
          .returning({ id: invoices.id, sequence: invoices.sequence });

        await tx.insert(invoiceLineItems).values(
          input.lines.map((line, index) => ({
            organizationId: input.organizationId,
            invoiceId: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
            sortOrder: index,
          })),
        );

        return invoice;
      });
    },
    async replaceLineItems(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(invoices)
          .set({
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            notes: input.notes,
            paymentInstructions: input.paymentInstructions,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(invoices.organizationId, input.organizationId),
              eq(invoices.id, input.invoiceId),
              eq(invoices.version, input.expectedVersion),
            ),
          )
          .returning({ id: invoices.id });
        if (!rows.length) throw new Error("This Invoice changed. Reload and try again.");

        // Draft line items carry no history worth keeping — nothing has been sent to anyone yet.
        await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, input.invoiceId));
        await tx.insert(invoiceLineItems).values(
          input.lines.map((line, index) => ({
            organizationId: input.organizationId,
            invoiceId: input.invoiceId,
            description: line.description,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
            sortOrder: index,
          })),
        );
      });
    },
    async markSent(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(invoices)
          .set({
            status: "sent",
            sentAt: input.sentAt,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(invoices.organizationId, input.organizationId),
              eq(invoices.id, input.invoiceId),
              eq(invoices.version, input.expectedVersion),
            ),
          )
          .returning({ id: invoices.id, sequence: invoices.sequence });
        if (!rows.length) throw new Error("This Invoice changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "invoice.sent",
          entityType: "invoice",
          entityId: input.invoiceId,
          summary: `Sent ${formatInvoiceNumber(rows[0].sequence)}.`,
          metadata: { sentAt: input.sentAt.toISOString() },
        });
      });
    },
    async markVoid(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(invoices)
          .set({
            status: "void",
            voidedAt: input.voidedAt,
            voidReason: input.reason,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(invoices.organizationId, input.organizationId),
              eq(invoices.id, input.invoiceId),
              eq(invoices.version, input.expectedVersion),
            ),
          )
          .returning({ id: invoices.id, sequence: invoices.sequence });
        if (!rows.length) throw new Error("This Invoice changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "invoice.voided",
          entityType: "invoice",
          entityId: input.invoiceId,
          summary: `Voided ${formatInvoiceNumber(rows[0].sequence)}. Reason: ${input.reason}`,
          metadata: { reason: input.reason },
        });
      });
    },
  };
}

export function createClientPaymentRepository(): ClientPaymentRepository {
  const db = getDatabase();
  return {
    async getInvoiceForPayment(organizationId, invoiceId) {
      const [row] = await db
        .select({ id: invoices.id, orderId: invoices.orderId, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, invoiceId)))
        .limit(1);
      return row ?? null;
    },
    async createPayment(input) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(clientPayments)
          .values({
            organizationId: input.organizationId,
            invoiceId: input.invoiceId,
            amountMinor: input.amountMinor,
            paidOn: input.paidOn,
            reference: input.reference,
            recordedByStaffId: input.actorStaffId,
          })
          .returning({ id: clientPayments.id });

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "client_payment.created",
          entityType: "client_payment",
          entityId: row.id,
          summary: `Recorded a client payment of ${formatMinor(input.amountMinor)}.`,
          metadata: { invoiceId: input.invoiceId, amountMinor: input.amountMinor, paidOn: input.paidOn },
        });

        return row;
      });
    },
    async getPayment(organizationId, paymentId) {
      const [row] = await db
        .select({ id: clientPayments.id, version: clientPayments.version, voidedAt: clientPayments.voidedAt })
        .from(clientPayments)
        .where(and(eq(clientPayments.organizationId, organizationId), eq(clientPayments.id, paymentId)))
        .limit(1);
      return row ?? null;
    },
    async updatePayment(input) {
      await db.transaction(async (tx) => {
        const previous = await tx
          .select({ amountMinor: clientPayments.amountMinor, paidOn: clientPayments.paidOn })
          .from(clientPayments)
          .where(eq(clientPayments.id, input.paymentId))
          .limit(1);

        const rows = await tx
          .update(clientPayments)
          .set({
            amountMinor: input.amountMinor,
            paidOn: input.paidOn,
            reference: input.reference,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clientPayments.organizationId, input.organizationId),
              eq(clientPayments.id, input.paymentId),
              eq(clientPayments.version, input.expectedVersion),
            ),
          )
          .returning({ id: clientPayments.id });
        if (!rows.length) throw new Error("This payment changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "client_payment.edited",
          entityType: "client_payment",
          entityId: input.paymentId,
          summary: `Edited a client payment to ${formatMinor(input.amountMinor)}.`,
          metadata: {
            previous: previous[0] ?? null,
            next: { amountMinor: input.amountMinor, paidOn: input.paidOn },
          },
        });
      });
    },
    async voidPayment(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(clientPayments)
          .set({
            voidedAt: new Date(),
            voidedByStaffId: input.actorStaffId,
            voidReason: input.reason,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clientPayments.organizationId, input.organizationId),
              eq(clientPayments.id, input.paymentId),
              eq(clientPayments.version, input.expectedVersion),
            ),
          )
          .returning({ id: clientPayments.id, amountMinor: clientPayments.amountMinor });
        if (!rows.length) throw new Error("This payment changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "client_payment.voided",
          entityType: "client_payment",
          entityId: input.paymentId,
          summary: `Voided a client payment of ${formatMinor(rows[0].amountMinor)}. Reason: ${input.reason}`,
          metadata: { reason: input.reason },
        });
      });
    },
  };
}

export function createVendorPaymentRepository(): VendorPaymentRepository {
  const db = getDatabase();
  return {
    async assignmentBelongsToOrganization(organizationId, assignmentId) {
      const [row] = await db
        .select({ id: vendorAssignments.id })
        .from(vendorAssignments)
        .where(and(eq(vendorAssignments.organizationId, organizationId), eq(vendorAssignments.id, assignmentId)))
        .limit(1);
      return !!row;
    },
    async createPayment(input) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(vendorPayments)
          .values({
            organizationId: input.organizationId,
            vendorAssignmentId: input.assignmentId,
            amountMinor: input.amountMinor,
            paidOn: input.paidOn,
            reference: input.reference,
            receiptR2ObjectKey: input.receipt?.objectKey ?? null,
            receiptMimeType: input.receipt?.mimeType ?? null,
            receiptByteSize: input.receipt?.byteSize ?? null,
            recordedByStaffId: input.actorStaffId,
          })
          .returning({ id: vendorPayments.id });

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "vendor_payment.created",
          entityType: "vendor_payment",
          entityId: row.id,
          summary: `Recorded a Vendor payment of ${formatMinor(input.amountMinor)}.`,
          metadata: {
            assignmentId: input.assignmentId,
            amountMinor: input.amountMinor,
            paidOn: input.paidOn,
            hasReceipt: !!input.receipt,
          },
        });

        return row;
      });
    },
    async getPayment(organizationId, paymentId) {
      const [row] = await db
        .select({ id: vendorPayments.id, version: vendorPayments.version, voidedAt: vendorPayments.voidedAt })
        .from(vendorPayments)
        .where(and(eq(vendorPayments.organizationId, organizationId), eq(vendorPayments.id, paymentId)))
        .limit(1);
      return row ?? null;
    },
    async voidPayment(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(vendorPayments)
          .set({
            voidedAt: new Date(),
            voidedByStaffId: input.actorStaffId,
            voidReason: input.reason,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vendorPayments.organizationId, input.organizationId),
              eq(vendorPayments.id, input.paymentId),
              eq(vendorPayments.version, input.expectedVersion),
            ),
          )
          .returning({ id: vendorPayments.id, amountMinor: vendorPayments.amountMinor });
        if (!rows.length) throw new Error("This payment changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: "vendor_payment.voided",
          entityType: "vendor_payment",
          entityId: input.paymentId,
          summary: `Voided a Vendor payment of ${formatMinor(rows[0].amountMinor)}. Reason: ${input.reason}`,
          metadata: { reason: input.reason },
        });
      });
    },
  };
}

export function createVendorPaymentStorage(): VendorPaymentStorage {
  return {
    putObject: putPrivateObject,
    deleteObject: deletePrivateObject,
    buildObjectKey: buildVendorReceiptObjectKey,
  };
}

export function createOrderCompletionRepository(): OrderCompletionRepository {
  const db = getDatabase();
  return {
    async getOrderForCompletion(organizationId, orderId) {
      // The invoiced total and the paid total are read here rather than trusted from the page, so a
      // stale form cannot claim a balance the database disagrees with.
      const [row] = await db
        .select({
          id: orders.id,
          version: orders.version,
          completedAt: orders.completedAt,
          archivedAt: orders.archivedAt,
          invoiceId: invoices.id,
        })
        .from(orders)
        .leftJoin(invoices, eq(invoices.orderId, orders.id))
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
        .limit(1);
      if (!row) return null;

      const invoicedMinor = row.invoiceId ? await sumInvoiceTotalMinor(row.invoiceId) : null;
      const paidMinor = row.invoiceId ? await sumLiveClientPaymentsMinor(organizationId, row.invoiceId) : 0;

      return {
        id: row.id,
        version: row.version,
        completedAt: row.completedAt,
        archivedAt: row.archivedAt,
        invoicedMinor,
        paidMinor,
      };
    },
    async completeOrder(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(orders)
          .set({
            completedAt: input.completedAt,
            completedByStaffId: input.actorStaffId,
            completionOverrideReason: input.overrideReason,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(orders.organizationId, input.organizationId),
              eq(orders.id, input.orderId),
              eq(orders.version, input.expectedVersion),
              // Belt and braces with the service's own check: two concurrent completions cannot both
              // land, so there is never a second completion or a second audit entry.
              isNull(orders.completedAt),
            ),
          )
          .returning({ id: orders.id });
        if (!rows.length) throw new Error("This Order changed. Reload and try again.");

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: input.overrideReason ? "order.completed_with_override" : "order.completed",
          entityType: "order",
          entityId: input.orderId,
          summary: input.auditSummary,
          metadata: { overrideReason: input.overrideReason },
        });
      });
    },
  };
}

function formatMinor(value: number): string {
  return `₦${(value / 100).toFixed(2)}`;
}

async function sumInvoiceTotalMinor(invoiceId: string): Promise<number> {
  const db = getDatabase();
  const lines = await db
    .select({ quantity: invoiceLineItems.quantity, unitPriceMinor: invoiceLineItems.unitPriceMinor })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));
  return computeInvoiceTotalMinor(lines);
}

async function sumLiveClientPaymentsMinor(organizationId: string, invoiceId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${clientPayments.amountMinor}), 0)::int` })
    .from(clientPayments)
    .where(
      and(
        eq(clientPayments.organizationId, organizationId),
        eq(clientPayments.invoiceId, invoiceId),
        // Voided payments are the "valid payments" exclusion from ticket 28.
        isNull(clientPayments.voidedAt),
      ),
    );
  return row?.total ?? 0;
}

export type InvoiceDetail = {
  id: string;
  orderId: string;
  orderTitle: string;
  clientId: string;
  clientName: string;
  sequence: number;
  invoiceNumber: string;
  lifecycle: InvoiceLifecycleStatus;
  issueDate: string;
  dueDate: string | null;
  notes: string;
  paymentInstructions: string;
  sentAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  version: number;
  lines: { id: string; description: string; quantity: number; unitPriceMinor: number }[];
  totalMinor: number;
  payments: {
    id: string;
    amountMinor: number;
    paidOn: string;
    reference: string;
    version: number;
    voidedAt: Date | null;
    voidReason: string | null;
    recordedByName: string;
  }[];
  paidMinor: number;
};

export async function getInvoiceForOrder(organizationId: string, orderId: string): Promise<InvoiceDetail | null> {
  const db = getDatabase();
  const [row] = await db
    .select({
      id: invoices.id,
      orderId: invoices.orderId,
      orderTitle: orders.title,
      clientId: clients.id,
      clientName: clients.fullName,
      sequence: invoices.sequence,
      lifecycle: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      notes: invoices.notes,
      paymentInstructions: invoices.paymentInstructions,
      sentAt: invoices.sentAt,
      voidedAt: invoices.voidedAt,
      voidReason: invoices.voidReason,
      version: invoices.version,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.orderId, orderId)))
    .limit(1);
  if (!row) return null;

  const [lines, payments] = await Promise.all([
    db
      .select({
        id: invoiceLineItems.id,
        description: invoiceLineItems.description,
        quantity: invoiceLineItems.quantity,
        unitPriceMinor: invoiceLineItems.unitPriceMinor,
      })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, row.id))
      .orderBy(asc(invoiceLineItems.sortOrder)),
    db
      .select({
        id: clientPayments.id,
        amountMinor: clientPayments.amountMinor,
        paidOn: clientPayments.paidOn,
        reference: clientPayments.reference,
        version: clientPayments.version,
        voidedAt: clientPayments.voidedAt,
        voidReason: clientPayments.voidReason,
        recordedByName: staffProfiles.fullName,
      })
      .from(clientPayments)
      .innerJoin(staffProfiles, eq(staffProfiles.id, clientPayments.recordedByStaffId))
      .where(eq(clientPayments.invoiceId, row.id))
      .orderBy(asc(clientPayments.paidOn)),
  ]);

  return {
    ...row,
    invoiceNumber: formatInvoiceNumber(row.sequence),
    lines,
    totalMinor: computeInvoiceTotalMinor(lines),
    payments,
    paidMinor: payments
      .filter((payment) => !payment.voidedAt)
      .reduce((total, payment) => total + payment.amountMinor, 0),
  };
}

/** The Order-level client balance inputs, for pages that show the position without the Invoice. */
export async function getOrderBalanceInputs(
  organizationId: string,
  orderId: string,
): Promise<{ invoicedMinor: number | null; paidMinor: number; invoiceId: string | null }> {
  const db = getDatabase();
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.orderId, orderId)))
    .limit(1);
  if (!row) return { invoicedMinor: null, paidMinor: 0, invoiceId: null };

  const [invoicedMinor, paidMinor] = await Promise.all([
    sumInvoiceTotalMinor(row.id),
    sumLiveClientPaymentsMinor(organizationId, row.id),
  ]);
  return { invoicedMinor, paidMinor, invoiceId: row.id };
}

export type VendorPaymentRow = {
  id: string;
  amountMinor: number;
  paidOn: string;
  reference: string;
  version: number;
  voidedAt: Date | null;
  voidReason: string | null;
  receiptR2ObjectKey: string | null;
  recordedByName: string;
};

export async function listVendorPayments(
  organizationId: string,
  assignmentId: string,
): Promise<VendorPaymentRow[]> {
  const db = getDatabase();
  return db
    .select({
      id: vendorPayments.id,
      amountMinor: vendorPayments.amountMinor,
      paidOn: vendorPayments.paidOn,
      reference: vendorPayments.reference,
      version: vendorPayments.version,
      voidedAt: vendorPayments.voidedAt,
      voidReason: vendorPayments.voidReason,
      receiptR2ObjectKey: vendorPayments.receiptR2ObjectKey,
      recordedByName: staffProfiles.fullName,
    })
    .from(vendorPayments)
    .innerJoin(staffProfiles, eq(staffProfiles.id, vendorPayments.recordedByStaffId))
    .where(
      and(eq(vendorPayments.organizationId, organizationId), eq(vendorPayments.vendorAssignmentId, assignmentId)),
    )
    .orderBy(asc(vendorPayments.paidOn));
}

export async function sumLiveVendorPaymentsMinor(organizationId: string, assignmentId: string): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${vendorPayments.amountMinor}), 0)::int` })
    .from(vendorPayments)
    .where(
      and(
        eq(vendorPayments.organizationId, organizationId),
        eq(vendorPayments.vendorAssignmentId, assignmentId),
        isNull(vendorPayments.voidedAt),
      ),
    );
  return row?.total ?? 0;
}

/**
 * Every live Order's client balance position, for the finance overview and the dashboard's
 * outstanding-balances metric. Totals and paid figures are summed from live rows here for the same
 * reason they are everywhere else: neither is stored, so neither can drift.
 */
export async function listOrderBalances(organizationId: string) {
  const db = getDatabase();

  const rows = await db
    .select({
      orderId: orders.id,
      orderTitle: orders.title,
      clientId: clients.id,
      clientName: clients.fullName,
      completedAt: orders.completedAt,
      invoiceId: invoices.id,
      invoiceSequence: invoices.sequence,
      invoiceStatus: invoices.status,
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .leftJoin(invoices, eq(invoices.orderId, orders.id))
    .where(and(eq(orders.organizationId, organizationId), isNull(orders.archivedAt)))
    .orderBy(asc(orders.createdAt));

  const positions = await Promise.all(
    rows.map(async (row) => {
      const invoicedMinor = row.invoiceId ? await sumInvoiceTotalMinor(row.invoiceId) : null;
      const paidMinor = row.invoiceId ? await sumLiveClientPaymentsMinor(organizationId, row.invoiceId) : 0;
      return {
        ...row,
        invoiceNumber: row.invoiceSequence === null ? null : formatInvoiceNumber(row.invoiceSequence),
        balance: computeOrderBalance({ invoicedMinor, paidMinor }),
      };
    }),
  );

  return positions;
}

/**
 * Vendor payment positions per live assignment. Mirrors the compact figure the production workspace
 * already shows per item, gathered here so the money can be read in one place.
 */
export async function listVendorPaymentPositions(organizationId: string) {
  const db = getDatabase();

  const rows = await db
    .select({
      assignmentId: vendorAssignments.id,
      vendorId: vendors.id,
      vendorName: vendors.name,
      agreedCostMinor: vendorAssignments.agreedVendorCostMinor,
      deadline: vendorAssignments.deadline,
      itemLabel: items.customLabel,
      itemTypeName: itemTypes.name,
      orderId: orders.id,
      orderTitle: orders.title,
    })
    .from(vendorAssignments)
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .where(
      and(
        eq(vendorAssignments.organizationId, organizationId),
        isNull(vendorAssignments.archivedAt),
        isNull(orders.archivedAt),
      ),
    )
    .orderBy(asc(vendorAssignments.deadline));

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      label: row.itemLabel ?? row.itemTypeName,
      position: computeVendorPaymentPosition({
        agreedCostMinor: row.agreedCostMinor,
        paidMinor: await sumLiveVendorPaymentsMinor(organizationId, row.assignmentId),
      }),
    })),
  );
}

/** Distinct Vendors with work on this Order — the rating prompts surfaced after completion. */
export async function listVendorsAwaitingRating(organizationId: string, orderId: string) {
  const db = getDatabase();
  return db
    .selectDistinctOn([vendors.id], { vendorId: vendors.id, vendorName: vendors.name })
    .from(vendorAssignments)
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .where(and(eq(vendorAssignments.organizationId, organizationId), eq(looks.orderId, orderId)))
    .orderBy(vendors.id);
}
