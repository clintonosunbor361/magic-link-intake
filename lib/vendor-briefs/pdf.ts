import "server-only";

import { formatBusinessDate } from "@/lib/domain/business-date";
import { escapeHtml, htmlDocument, renderHtmlToPdf, textWithBreaks } from "@/lib/pdf/html-to-pdf";
import type { VendorBriefDocument } from "@/lib/vendor-briefs/document";

export type RenderableBriefImage = { revisionId: string; label: string; data: Buffer<ArrayBuffer> };

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #1d1f36; font: 10pt/1.45 Arial, sans-serif; }
  .brand { font-size: 9pt; font-weight: 800; letter-spacing: .16em; }
  .eyebrow, h2 { color: #626878; font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 5px 0 0; font-size: 22pt; line-height: 1.1; }
  .vendor { margin-top: 3px; color: #3d4256; font-size: 11pt; }
  hr { margin: 16px 0 18px; border: 0; border-top: 1px solid #d9d8d1; }
  .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .label, .meta { color: #626878; font-size: 8pt; }
  .value { margin-top: 2px; font-size: 11pt; overflow-wrap: anywhere; }
  section { margin-top: 22px; }
  h2 { margin: 0 0 7px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr, .note, figure { break-inside: avoid; }
  td { padding: 6px 0; border-bottom: 1px solid #eceae4; }
  td:last-child { font-weight: 700; text-align: right; }
  .note { margin-bottom: 12px; }
  p { margin: 2px 0 0; overflow-wrap: anywhere; }
  .references { break-before: page; }
  figure { margin: 0 0 18px; }
  figcaption { margin-bottom: 5px; color: #626878; font-size: 8pt; }
  img { display: block; max-width: 100%; max-height: 235mm; object-fit: contain; }
`;

export function buildVendorBriefHtml(document: VendorBriefDocument, images: RenderableBriefImage[], exportedOn: string): string {
  const facts: [string, string][] = [
    ["Item", document.itemLabel ?? document.itemTypeName],
    ["Item type", document.itemTypeName],
    ["Look", document.lookName],
    ["Order", document.orderReference],
  ];
  if (document.quantity !== null) facts.push(["Quantity", String(document.quantity)]);
  if (document.deadline !== null) facts.push(["Production deadline", formatBusinessDate(document.deadline)]);
  if (document.clientName !== null) facts.push(["Client", document.clientName]);

  const measurements = document.measurements.length ? `<section><h2>Measurements</h2><table><tbody>${document.measurements.map((measurement) => `<tr><td>${escapeHtml(measurement.label)}</td><td>${escapeHtml(`${measurement.value} ${measurement.unit}`)}</td></tr>`).join("")}</tbody></table></section>` : "";
  const notes = document.notes.length ? `<section><h2>Consultation notes</h2>${document.notes.map((note) => `<div class="note"><div class="meta">${escapeHtml(note.sourceLabel)} · ${escapeHtml(note.recordedOn)}</div><p>${textWithBreaks(note.body)}</p></div>`).join("")}</section>` : "";
  const instructions = document.additionalInstructions ? `<section><h2>Additional instructions</h2><p>${textWithBreaks(document.additionalInstructions)}</p></section>` : "";
  const references = images.length ? `<section class="references"><h2>References</h2>${images.map((image) => `<figure><figcaption>${escapeHtml(image.label)}</figcaption><img alt="" src="data:image/jpeg;base64,${image.data.toString("base64")}"></figure>`).join("")}</section>` : "";

  return htmlDocument({
    title: `Vendor Brief — ${document.itemLabel ?? document.itemTypeName}`,
    styles,
    body: `<div class="brand">KUARTZ.</div><div class="eyebrow">Vendor Brief</div><h1>${escapeHtml(document.itemLabel ?? document.itemTypeName)}</h1><div class="vendor">For ${escapeHtml(document.vendorName)}${document.vendorPhone ? ` · ${escapeHtml(document.vendorPhone)}` : ""}</div><hr><section><h2>Details</h2><div class="facts">${facts.map(([label, value]) => `<div><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("")}</div></section>${measurements}${notes}${instructions}${references}<section><p class="label">Exported ${formatBusinessDate(exportedOn)} · Kuartz</p></section>`,
  });
}

export function renderVendorBriefPdf(document: VendorBriefDocument, images: RenderableBriefImage[], exportedOn: string): Promise<Buffer> {
  return renderHtmlToPdf(buildVendorBriefHtml(document, images, exportedOn), {
    title: `Vendor Brief — ${document.itemLabel ?? document.itemTypeName}`,
    author: "Kuartz",
    subject: `Vendor brief for ${document.vendorName}`,
  });
}
