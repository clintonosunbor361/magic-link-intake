import { renderToBuffer } from "@react-pdf/renderer";
import { type NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { canManageFinance } from "@/lib/domain/access-control";
import { buildInvoiceDocument } from "@/lib/finance/invoice-document";
import { InvoicePdf } from "@/lib/finance/invoice-pdf";
import { markInvoiceSent } from "@/lib/finance/invoice-service";
import { createInvoiceRepository, getInvoiceForOrder } from "@/lib/finance/repository";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { getDatabase } from "@/db";
import { invoices, orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Sending an Invoice and producing its PDF are one act, for the same reason the Vendor Brief export
// is: hitting this route is what makes the send real, so the Draft → Sent transition and the audit
// entry are written in the same call that streams the bytes. A GET would be prefetchable and could
// mark an Invoice sent because someone hovered a link.
//
// The PDF is never written to R2 or disk — Phase 1 keeps no generated artifacts.
export async function POST(request: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireStaffSession();
  const { invoiceId } = await context.params;

  if (!canManageFinance(session.role)) {
    return NextResponse.json({ error: "Super Admin access is required for financial records." }, { status: 403 });
  }

  const orderId = await resolveOrderId(session.organizationId, invoiceId);
  if (!orderId) return NextResponse.json({ error: "Invoice was not found." }, { status: 404 });

  const invoice = await getInvoiceForOrder(session.organizationId, orderId);
  if (!invoice) return NextResponse.json({ error: "Invoice was not found." }, { status: 404 });

  try {
    await markInvoiceSent(
      {
        actor: { role: session.role, staffId: session.userId },
        organizationId: session.organizationId,
        invoiceId,
        expectedVersion: invoice.version,
      },
      createInvoiceRepository(),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This Invoice could not be sent." },
      { status: 422 },
    );
  }

  const document = buildInvoiceDocument({
    invoiceNumber: invoice.invoiceNumber,
    organizationName: session.organizationName,
    clientName: invoice.clientName,
    orderReference: invoice.orderTitle,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    lines: invoice.lines,
    paidMinor: invoice.paidMinor,
    notes: invoice.notes,
    paymentInstructions: invoice.paymentInstructions,
  });

  const timezone = await getOrganizationTimezone(session.organizationId);
  const pdf = await renderToBuffer(<InvoicePdf document={document} issuedOn={businessToday(timezone)} />);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber.toLowerCase()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

async function resolveOrderId(organizationId: string, invoiceId: string): Promise<string | null> {
  const db = getDatabase();
  const [row] = await db
    .select({ orderId: invoices.orderId })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, invoiceId)))
    .limit(1);
  return row?.orderId ?? null;
}
