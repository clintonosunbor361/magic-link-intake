import "server-only";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { VendorBriefDocument } from "@/lib/vendor-briefs/document";

// The PDF half of the two renderers. Layout differs from the HTML preview — this is a print
// document, not a screen — but both are built from the same VendorBriefDocument, so what a person
// reviews is what the vendor receives.
//
// Only the built-in Helvetica family is used: registering a webfont would mean a network fetch
// during export, and a brief that fails to render because a font CDN is slow is worse than a brief
// in Helvetica.

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1d1f36" },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase", color: "#6b7180" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 6 },
  vendorLine: { fontSize: 11, marginTop: 2, color: "#3d4256" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#d9d8d1", marginTop: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7180", marginBottom: 8 },
  section: { marginBottom: 20 },
  facts: { flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", marginBottom: 10, paddingRight: 12 },
  factLabel: { fontSize: 8, color: "#6b7180", marginBottom: 2 },
  factValue: { fontSize: 11 },
  measurementRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#eceae4" },
  measurementLabel: { fontSize: 10 },
  measurementValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  note: { marginBottom: 10 },
  noteMeta: { fontSize: 8, color: "#6b7180", marginBottom: 2 },
  noteBody: { fontSize: 10, lineHeight: 1.45 },
  instructions: { fontSize: 10, lineHeight: 1.45 },
  imageBlock: { marginBottom: 14 },
  imageCaption: { fontSize: 8, color: "#6b7180", marginBottom: 4 },
  image: { width: "100%", maxHeight: 320, objectFit: "contain" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#8b8f9c", textAlign: "center" },
});

export type RenderableBriefImage = { revisionId: string; label: string; data: Buffer<ArrayBuffer> };

export function VendorBriefPdf({
  document,
  images,
  exportedOn,
}: {
  document: VendorBriefDocument;
  images: RenderableBriefImage[];
  exportedOn: string;
}) {
  const facts: { label: string; value: string }[] = [
    { label: "Item", value: document.itemLabel ?? document.itemTypeName },
    { label: "Item type", value: document.itemTypeName },
    { label: "Look", value: document.lookName },
    { label: "Order", value: document.orderReference },
  ];
  if (document.quantity !== null) facts.push({ label: "Quantity", value: String(document.quantity) });
  if (document.deadline !== null) facts.push({ label: "Production deadline", value: document.deadline });
  if (document.clientName !== null) facts.push({ label: "Client", value: document.clientName });

  return (
    <Document title={`Vendor Brief — ${document.itemLabel ?? document.itemTypeName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Vendor Brief</Text>
        <Text style={styles.title}>{document.itemLabel ?? document.itemTypeName}</Text>
        <Text style={styles.vendorLine}>
          For {document.vendorName}
          {document.vendorPhone ? ` · ${document.vendorPhone}` : ""}
        </Text>
        <View style={styles.rule} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.facts}>
            {facts.map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Text style={styles.factLabel}>{fact.label}</Text>
                <Text style={styles.factValue}>{fact.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {document.measurements.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Measurements</Text>
            {document.measurements.map((measurement) => (
              <View key={measurement.label} style={styles.measurementRow}>
                <Text style={styles.measurementLabel}>{measurement.label}</Text>
                <Text style={styles.measurementValue}>
                  {measurement.value} {measurement.unit}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {document.notes.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Consultation notes</Text>
            {document.notes.map((note, index) => (
              <View key={`${note.sourceLabel}-${index}`} style={styles.note} wrap={false}>
                <Text style={styles.noteMeta}>
                  {note.sourceLabel} · {note.recordedOn}
                </Text>
                <Text style={styles.noteBody}>{note.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {document.additionalInstructions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional instructions</Text>
            <Text style={styles.instructions}>{document.additionalInstructions}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Exported {exportedOn} · Kuartz
        </Text>
      </Page>

      {images.length ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>References</Text>
          {images.map((image) => (
            <View key={image.revisionId} style={styles.imageBlock} wrap={false}>
              <Text style={styles.imageCaption}>{image.label}</Text>
              <Image style={styles.image} src={image.data} />
            </View>
          ))}
          <Text style={styles.footer} fixed>
            Exported {exportedOn} · Kuartz
          </Text>
        </Page>
      ) : null}
    </Document>
  );
}
