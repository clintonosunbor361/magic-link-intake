import "server-only";

import { formatBusinessDate } from "@/lib/domain/business-date";
import type { InvoiceDocument } from "@/lib/finance/invoice-document";
import { formatMinorUnitsLocale } from "@/lib/forms/money";
import { escapeHtml, htmlDocument, renderHtmlToPdf } from "@/lib/pdf/html-to-pdf";

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #1d1f36; font: 10pt/1.45 Arial, sans-serif; }
  .brand { font-size: 9pt; font-weight: 800; letter-spacing: .16em; }
  .eyebrow, th, h2 { color: #626878; font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 5px 0 0; font-size: 22pt; line-height: 1.1; }
  .org { margin-top: 3px; color: #3d4256; font-size: 11pt; }
  hr { margin: 16px 0 18px; border: 0; border-top: 1px solid #d9d8d1; }
  .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 24px; }
  .label { color: #626878; font-size: 8pt; }
  .value { margin-top: 2px; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { padding: 7px 6px; border-bottom: 1px solid #eceae4; text-align: right; vertical-align: top; }
  th:first-child, td:first-child { padding-left: 0; text-align: left; }
  .description { width: 46%; overflow-wrap: anywhere; }
  .totals { width: 250px; margin: 14px 0 24px auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .strong { font-weight: 800; }
  section { margin-top: 22px; break-inside: avoid; }
  h2 { margin: 0 0 7px; }
  p { margin: 0; overflow-wrap: anywhere; }
`;

function naira(minor: number): string {
  return `NGN ${formatMinorUnitsLocale(minor)}`;
}

export function buildInvoiceHtml(document: InvoiceDocument, issuedOn: string): string {
  const facts = [
    ["Billed to", document.clientName],
    ["Order", document.orderReference],
    ["Issue date", formatBusinessDate(document.issueDate)],
    ...(document.dueDate ? [["Due date", formatBusinessDate(document.dueDate)]] : []),
  ];
  const rows = document.lines.map((line) => `<tr><td class="description">${escapeHtml(line.description)}</td><td>${line.quantity}</td><td>${naira(line.unitPriceMinor)}</td><td>${naira(line.amountMinor)}</td></tr>`).join("");
  const optional = [
    document.paymentInstructions ? `<section><h2>Payment instructions</h2><p>${escapeHtml(document.paymentInstructions)}</p></section>` : "",
    document.notes ? `<section><h2>Notes</h2><p>${escapeHtml(document.notes)}</p></section>` : "",
  ].join("");

  return htmlDocument({
    title: `Invoice ${document.invoiceNumber}`,
    styles,
    body: `<div class="brand">KUARTZ.</div><div class="eyebrow">Invoice</div><h1>${escapeHtml(document.invoiceNumber)}</h1><div class="org">${escapeHtml(document.organizationName)}</div><hr><div class="facts">${facts.map(([label, value]) => `<div><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("")}</div><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Total</span><strong>${naira(document.totalMinor)}</strong></div><div><span>Paid</span><span>${naira(document.paidMinor)}</span></div><div class="strong"><span>Balance</span><span>${naira(document.balanceMinor)}</span></div></div>${optional}<section><p class="label">Issued ${formatBusinessDate(issuedOn)} · ${escapeHtml(document.organizationName)}</p></section>`,
  });
}

export function renderInvoicePdf(document: InvoiceDocument, issuedOn: string): Promise<Buffer> {
  return renderHtmlToPdf(buildInvoiceHtml(document, issuedOn), {
    title: `Invoice ${document.invoiceNumber}`,
    author: document.organizationName,
    subject: `Invoice for ${document.orderReference}`,
  });
}
