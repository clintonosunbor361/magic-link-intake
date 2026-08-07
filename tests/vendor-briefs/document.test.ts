import { describe, expect, it } from "vitest";
import {
  buildVendorBriefDocument,
  computeBriefBlocker,
  defaultBriefSelection,
  emptyBriefEdits,
  MAX_BRIEF_IMAGES,
  resolveExportPermission,
  type VendorBriefSources,
} from "@/lib/vendor-briefs/document";

function sources(overrides: Partial<VendorBriefSources> = {}): VendorBriefSources {
  return {
    vendorName: "Tunde Fabrics",
    vendorPhone: "+2348012345678",
    clientName: "Adaeze Okafor",
    orderReference: "ORD-114",
    lookName: "Reception Look",
    itemTypeName: "Agbada",
    itemLabel: "Cream agbada",
    quantity: 1,
    deadline: "2026-09-01",
    measurements: [
      { fieldDefinitionId: "chest", label: "Chest", unit: "in", value: "42", required: true },
      { fieldDefinitionId: "sleeve", label: "Sleeve length", unit: "in", value: "25", required: true },
      { fieldDefinitionId: "neck", label: "Neck", unit: "in", value: "16", required: false },
    ],
    notes: [
      { id: "note-1", sourceLabel: "In-person consultation", body: "Fuller sleeves than reference.", recordedOn: "2026-08-01" },
      { id: "note-2", sourceLabel: "WhatsApp", body: "Client is price-insensitive, upsell fabric.", recordedOn: "2026-08-02" },
    ],
    images: [
      { revisionId: "rev-1", label: "Front sketch", mimeType: "image/jpeg" },
      { revisionId: "rev-2", label: "Fabric reference", mimeType: "image/jpeg" },
    ],
    ...overrides,
  };
}

describe("defaultBriefSelection", () => {
  it("ticks required measurements and nothing internal", () => {
    const selection = defaultBriefSelection(sources());

    expect(selection.measurementFieldIds).toEqual(["chest", "sleeve"]);
    expect(selection.noteIds).toEqual([]);
    expect(selection.imageRevisionIds).toEqual([]);
    expect(selection.includeClientName).toBe(false);
  });
});

describe("buildVendorBriefDocument", () => {
  it("includes only what was selected for this export", () => {
    const document = buildVendorBriefDocument({
      sources: sources(),
      selection: { ...defaultBriefSelection(sources()), noteIds: ["note-1"], imageRevisionIds: ["rev-1"] },
      edits: emptyBriefEdits(),
    });

    expect(document.measurements.map((m) => m.label)).toEqual(["Chest", "Sleeve length"]);
    expect(document.notes.map((n) => n.body)).toEqual(["Fuller sleeves than reference."]);
    expect(document.images.map((i) => i.revisionId)).toEqual(["rev-1"]);
  });

  it("omits a commercially sensitive note that was not ticked", () => {
    const document = buildVendorBriefDocument({
      sources: sources(),
      selection: defaultBriefSelection(sources()),
      edits: emptyBriefEdits(),
    });

    expect(JSON.stringify(document)).not.toContain("upsell");
  });

  it("withholds the client's name unless it is explicitly included", () => {
    const base = defaultBriefSelection(sources());

    expect(buildVendorBriefDocument({ sources: sources(), selection: base, edits: emptyBriefEdits() }).clientName).toBeNull();
    expect(
      buildVendorBriefDocument({
        sources: sources(),
        selection: { ...base, includeClientName: true },
        edits: emptyBriefEdits(),
      }).clientName,
    ).toBe("Adaeze Okafor");
  });

  it("applies preview edits to the document without altering the sources", () => {
    const input = sources();
    const document = buildVendorBriefDocument({
      sources: input,
      selection: defaultBriefSelection(input),
      edits: { measurementValues: { chest: "43" }, noteBodies: {}, additionalInstructions: "  Add 1in ease.  " },
    });

    expect(document.measurements.find((m) => m.label === "Chest")?.value).toBe("43");
    expect(document.additionalInstructions).toBe("Add 1in ease.");
    // The source object is untouched — nothing in this module writes back.
    expect(input.measurements.find((m) => m.fieldDefinitionId === "chest")?.value).toBe("42");
  });

  it("drops a measurement whose value is blank after edits", () => {
    const input = sources();
    const document = buildVendorBriefDocument({
      sources: input,
      selection: defaultBriefSelection(input),
      edits: { measurementValues: { chest: "   " }, noteBodies: {}, additionalInstructions: "" },
    });

    expect(document.measurements.map((m) => m.label)).toEqual(["Sleeve length"]);
  });

  it("caps embedded images at the documented maximum", () => {
    const many = Array.from({ length: MAX_BRIEF_IMAGES + 4 }, (_, index) => ({
      revisionId: `rev-${index}`,
      label: `Reference ${index}`,
      mimeType: "image/jpeg",
    }));
    const input = sources({ images: many });

    const document = buildVendorBriefDocument({
      sources: input,
      selection: { ...defaultBriefSelection(input), imageRevisionIds: many.map((image) => image.revisionId) },
      edits: emptyBriefEdits(),
    });

    expect(document.images).toHaveLength(MAX_BRIEF_IMAGES);
  });

  it("normalises an empty additional-instructions edit to null", () => {
    const input = sources();
    const document = buildVendorBriefDocument({
      sources: input,
      selection: defaultBriefSelection(input),
      edits: { measurementValues: {}, noteBodies: {}, additionalInstructions: "   " },
    });

    expect(document.additionalInstructions).toBeNull();
  });
});

describe("computeBriefBlocker", () => {
  it("passes when every required measurement is present", () => {
    expect(computeBriefBlocker(sources())).toBeNull();
  });

  it("blocks on a missing required measurement and names it", () => {
    const blocker = computeBriefBlocker(
      sources({
        measurements: [
          { fieldDefinitionId: "chest", label: "Chest", unit: "in", value: "42", required: true },
          { fieldDefinitionId: "sleeve", label: "Sleeve length", unit: "in", value: null, required: true },
        ],
      }),
    );

    expect(blocker).toEqual({ missingFieldIds: ["sleeve"], missingLabels: ["Sleeve length"] });
  });

  it("treats a whitespace-only value as missing", () => {
    const blocker = computeBriefBlocker(
      sources({
        measurements: [{ fieldDefinitionId: "chest", label: "Chest", unit: "in", value: "   ", required: true }],
      }),
    );

    expect(blocker?.missingLabels).toEqual(["Chest"]);
  });

  it("ignores an optional measurement that is missing", () => {
    expect(
      computeBriefBlocker(
        sources({
          measurements: [
            { fieldDefinitionId: "chest", label: "Chest", unit: "in", value: "42", required: true },
            { fieldDefinitionId: "neck", label: "Neck", unit: "in", value: null, required: false },
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe("resolveExportPermission", () => {
  const blocker = { missingFieldIds: ["sleeve"], missingLabels: ["Sleeve length"] };

  it("allows an unblocked export for either role with no reason", () => {
    expect(resolveExportPermission({ blocker: null, role: "admin_assistant", overrideReason: null })).toEqual({
      allowed: true,
      overrideReason: null,
    });
  });

  it("refuses an Admin Assistant even when they supply a reason", () => {
    expect(() =>
      resolveExportPermission({ blocker, role: "admin_assistant", overrideReason: "Client is waiting" }),
    ).toThrow("A Super Admin must override");
  });

  it("names the missing measurements in the refusal", () => {
    expect(() => resolveExportPermission({ blocker, role: "admin_assistant", overrideReason: null })).toThrow(
      "Sleeve length",
    );
  });

  it("requires a non-blank reason from a Super Admin", () => {
    expect(() => resolveExportPermission({ blocker, role: "super_admin", overrideReason: null })).toThrow(
      "A reason is required",
    );
    expect(() => resolveExportPermission({ blocker, role: "super_admin", overrideReason: "   " })).toThrow(
      "A reason is required",
    );
  });

  it("allows a Super Admin override and returns the trimmed reason for auditing", () => {
    expect(
      resolveExportPermission({ blocker, role: "super_admin", overrideReason: "  Vendor starts cutting today  " }),
    ).toEqual({ allowed: true, overrideReason: "Vendor starts cutting today" });
  });
});
