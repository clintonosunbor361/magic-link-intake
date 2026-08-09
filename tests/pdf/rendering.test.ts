import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildInvoiceHtml, renderInvoicePdf } from "@/lib/finance/invoice-pdf";
import { buildVendorBriefHtml, renderVendorBriefPdf } from "@/lib/vendor-briefs/pdf";

describe("server-side HTML-to-PDF rendering", () => {
  it("uses a repeating table header and writes explicit Invoice metadata", async () => {
    const lines = Array.from({ length: 80 }, (_, index) => ({
      description: `Custom garment line ${index + 1} with enough detail to exercise wrapping`,
      quantity: 1,
      unitPriceMinor: 125_000_00,
      amountMinor: 125_000_00,
    }));
    const totalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
    const document = {
      invoiceNumber: "INV-0099",
      organizationName: "Kuartz by Roti",
      clientName: "Adaeze Okafor",
      orderReference: "Wedding wardrobe",
      issueDate: "2026-08-01",
      dueDate: "2026-08-15",
      lines,
      totalMinor,
      paidMinor: 0,
      balanceMinor: totalMinor,
      notes: "Prepared from live Invoice records.",
      paymentInstructions: "Bank transfer",
    };

    const html = buildInvoiceHtml(document, "2026-08-09");
    expect(html).toContain("<thead>");
    expect(html).toContain("thead { display: table-header-group; }");

    const bytes = await renderInvoicePdf(document, "2026-08-09");
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    const metadata = await PDFDocument.load(bytes);
    expect(metadata.getTitle()).toBe("Invoice INV-0099");
    expect(metadata.getAuthor()).toBe("Kuartz by Roti");
  }, 20_000);

  it("escapes Vendor Brief source values before rendering", async () => {
    const document = {
      vendorName: "Tunde <script>alert(1)</script>",
      vendorPhone: "+2348012345678",
      clientName: null,
      orderReference: "Wedding wardrobe",
      lookName: "Traditional ceremony",
      itemTypeName: "Agbada",
      itemLabel: "Cream agbada",
      quantity: 1,
      deadline: "2026-08-21",
      measurements: [{ label: "Chest", unit: "in", value: "42", required: true }],
      notes: [],
      images: [],
      additionalInstructions: null,
    };
    const html = buildVendorBriefHtml(document, [], "2026-08-09");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    const bytes = await renderVendorBriefPdf(document, [], "2026-08-09");
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  }, 20_000);
});
