import "server-only";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceDocument } from "@/lib/finance/invoice-document";
import { formatMinorUnits } from "@/lib/forms/money";

// Built-in Helvetica only, for the same reason as the Vendor Brief: registering a webfont would put
// a network fetch in the path of producing an invoice.

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1d1f36" },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase", color: "#6b7180" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 6 },
  org: { fontSize: 11, marginTop: 2, color: "#3d4256" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#d9d8d1", marginTop: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7180", marginBottom: 8 },
  section: { marginBottom: 20 },
  facts: { flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", marginBottom: 10, paddingRight: 12 },
  factLabel: { fontSize: 8, color: "#6b7180", marginBottom: 2 },
  factValue: { fontSize: 11 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d9d8d1", paddingBottom: 5 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#eceae4" },
  colDescription: { flex: 1, fontSize: 10 },
  colNumeric: { width: 90, fontSize: 10, textAlign: "right" },
  headCell: { fontSize: 8, color: "#6b7180", textTransform: "uppercase", letterSpacing: 0.8 },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalsLabel: { fontSize: 10, color: "#3d4256", width: 140, textAlign: "right", paddingRight: 12 },
  totalsValue: { fontSize: 10, width: 90, textAlign: "right" },
  totalsStrong: { fontFamily: "Helvetica-Bold" },
  body: { fontSize: 10, lineHeight: 1.45 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#8b8f9c", textAlign: "center" },
});

function naira(minor: number): string {
  return `NGN ${formatMinorUnits(minor)}`;
}

export function InvoicePdf({ document, issuedOn }: { document: InvoiceDocument; issuedOn: string }) {
  const facts: { label: string; value: string }[] = [
    { label: "Billed to", value: document.clientName },
    { label: "Order", value: document.orderReference },
    { label: "Issue date", value: document.issueDate },
  ];
  if (document.dueDate) facts.push({ label: "Due date", value: document.dueDate });

  return (
    <Document title={`Invoice ${document.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Invoice</Text>
        <Text style={styles.title}>{document.invoiceNumber}</Text>
        <Text style={styles.org}>{document.organizationName}</Text>
        <View style={styles.rule} />

        <View style={styles.section}>
          <View style={styles.facts}>
            {facts.map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Text style={styles.factLabel}>{fact.label}</Text>
                <Text style={styles.factValue}>{fact.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.tableHead}>
            <Text style={[styles.colDescription, styles.headCell]}>Description</Text>
            <Text style={[styles.colNumeric, styles.headCell]}>Qty</Text>
            <Text style={[styles.colNumeric, styles.headCell]}>Unit price</Text>
            <Text style={[styles.colNumeric, styles.headCell]}>Amount</Text>
          </View>
          {document.lines.map((line, index) => (
            <View key={`${line.description}-${index}`} style={styles.row} wrap={false}>
              <Text style={styles.colDescription}>{line.description}</Text>
              <Text style={styles.colNumeric}>{line.quantity}</Text>
              <Text style={styles.colNumeric}>{naira(line.unitPriceMinor)}</Text>
              <Text style={styles.colNumeric}>{naira(line.amountMinor)}</Text>
            </View>
          ))}

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total</Text>
            <Text style={[styles.totalsValue, styles.totalsStrong]}>{naira(document.totalMinor)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Paid</Text>
            <Text style={styles.totalsValue}>{naira(document.paidMinor)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Balance</Text>
            <Text style={[styles.totalsValue, styles.totalsStrong]}>{naira(document.balanceMinor)}</Text>
          </View>
        </View>

        {document.paymentInstructions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment instructions</Text>
            <Text style={styles.body}>{document.paymentInstructions}</Text>
          </View>
        ) : null}

        {document.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.body}>{document.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Issued {issuedOn} · {document.organizationName}
        </Text>
      </Page>
    </Document>
  );
}
