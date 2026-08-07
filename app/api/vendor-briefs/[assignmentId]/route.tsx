import { renderToBuffer } from "@react-pdf/renderer";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireStaffSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/domain/business-date";
import { getOrganizationTimezone } from "@/lib/organizations/repository";
import { getPrivateObjectBytes } from "@/lib/storage/r2";
import {
  buildVendorBriefDocument,
  MAX_BRIEF_IMAGES,
  type VendorBriefEdits,
  type VendorBriefSelection,
} from "@/lib/vendor-briefs/document";
import { decideBriefExport, recordBriefExport } from "@/lib/vendor-briefs/export-service";
import { VendorBriefPdf, type RenderableBriefImage } from "@/lib/vendor-briefs/pdf";
import { createBriefExportRepository, getVendorBriefContext } from "@/lib/vendor-briefs/repository";

// Exporting is a POST, not a GET, because it mutates: hitting this route is what makes the export
// real, and it writes the export metadata and the audit entry in the same call that streams the
// bytes. A GET would be prefetchable and would let a link hover record an export that never
// happened.
//
// The PDF itself is never written to R2 or disk — Phase 1 keeps export metadata, not artifacts.
export async function POST(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const session = await requireStaffSession();
  const { assignmentId } = await context.params;

  const briefContext = await getVendorBriefContext(session.organizationId, assignmentId);
  if (!briefContext) {
    return NextResponse.json({ error: "Vendor assignment was not found." }, { status: 404 });
  }

  const payload = await readPayload(request);

  let decision;
  try {
    decision = decideBriefExport({
      sources: briefContext.sources,
      role: session.role,
      overrideReason: payload.overrideReason,
    });
  } catch (error) {
    // The measurement blocker refusing an export, or a Super Admin omitting the required reason.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This brief cannot be exported." },
      { status: 422 },
    );
  }

  const document = buildVendorBriefDocument({
    sources: briefContext.sources,
    selection: payload.selection,
    edits: payload.edits,
  });

  const images = await loadImages(briefContext.imageObjects, document.images.map((image) => image.revisionId));

  const timezone = await getOrganizationTimezone(session.organizationId);
  const pdf = await renderToBuffer(
    <VendorBriefPdf document={document} images={images} exportedOn={businessToday(timezone)} />,
  );

  await recordBriefExport(
    {
      organizationId: session.organizationId,
      assignmentId,
      actor: { staffId: session.userId },
      decision,
    },
    createBriefExportRepository(),
  );

  const filename = `vendor-brief-${slugify(document.itemLabel ?? document.itemTypeName)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Nothing about a brief should be cached: it is assembled from live records every time.
      "Cache-Control": "no-store",
    },
  });
}

type ExportPayload = {
  selection: VendorBriefSelection;
  edits: VendorBriefEdits;
  overrideReason: string | null;
};

async function readPayload(request: NextRequest): Promise<ExportPayload> {
  const body = (await request.json().catch(() => ({}))) as Partial<{
    selection: VendorBriefSelection;
    edits: VendorBriefEdits;
    overrideReason: string;
  }>;

  return {
    selection: {
      includeClientName: body.selection?.includeClientName ?? false,
      includeQuantity: body.selection?.includeQuantity ?? true,
      includeDeadline: body.selection?.includeDeadline ?? true,
      measurementFieldIds: body.selection?.measurementFieldIds ?? [],
      noteIds: body.selection?.noteIds ?? [],
      imageRevisionIds: (body.selection?.imageRevisionIds ?? []).slice(0, MAX_BRIEF_IMAGES),
    },
    edits: {
      measurementValues: body.edits?.measurementValues ?? {},
      noteBodies: body.edits?.noteBodies ?? {},
      additionalInstructions: body.edits?.additionalInstructions ?? "",
    },
    overrideReason: body.overrideReason?.trim() || null,
  };
}

// Fetched from R2 and downscaled before embedding: a phone photo at full resolution would make a
// brief tens of megabytes, which is unusable over WhatsApp — the exact channel these are sent on.
async function loadImages(
  available: { revisionId: string; label: string; r2ObjectKey: string }[],
  selectedIds: string[],
): Promise<RenderableBriefImage[]> {
  const selected = available.filter((image) => selectedIds.includes(image.revisionId));

  const loaded = await Promise.all(
    selected.map(async (image) => {
      try {
        const original = await getPrivateObjectBytes(image.r2ObjectKey);
        const data = await sharp(original, { failOn: "none" })
          .rotate()
          .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 78 })
          .toBuffer();
        return { revisionId: image.revisionId, label: image.label, data };
      } catch {
        // One unreadable reference must not cost the whole brief — the rest still exports.
        return null;
      }
    }),
  );

  return loaded.filter((image): image is RenderableBriefImage => image !== null);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}
