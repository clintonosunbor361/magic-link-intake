import { computeLineAmountMinor, computeInvoiceTotalMinor } from "@/lib/finance/invoice";

// The typed payload behind the Invoice PDF. Assembled fresh from live records on every send — Phase
// 1 stores no generated PDF and no snapshot of this shape.

export type InvoiceDocumentLine = {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
};

export type InvoiceDocument = {
  invoiceNumber: string;
  organizationName: string;
  clientName: string;
  orderReference: string;
  issueDate: string;
  dueDate: string | null;
  lines: InvoiceDocumentLine[];
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  notes: string | null;
  paymentInstructions: string | null;
};

export function buildInvoiceDocument(input: {
  invoiceNumber: string;
  organizationName: string;
  clientName: string;
  orderReference: string;
  issueDate: string;
  dueDate: string | null;
  lines: { description: string; quantity: number; unitPriceMinor: number }[];
  paidMinor: number;
  notes: string;
  paymentInstructions: string;
}): InvoiceDocument {
  const totalMinor = computeInvoiceTotalMinor(input.lines);

  return {
    invoiceNumber: input.invoiceNumber,
    organizationName: input.organizationName,
    clientName: input.clientName,
    orderReference: input.orderReference,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    lines: input.lines.map((line) => ({ ...line, amountMinor: computeLineAmountMinor(line) })),
    totalMinor,
    paidMinor: input.paidMinor,
    balanceMinor: totalMinor - input.paidMinor,
    notes: input.notes.trim() || null,
    paymentInstructions: input.paymentInstructions.trim() || null,
  };
}
