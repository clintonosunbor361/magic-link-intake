import "server-only";

import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEntries,
  clients,
  consultationNotes,
  consultationNoteSources,
  itemTypeMeasurementRequirements,
  items,
  itemTypes,
  looks,
  measurementFieldDefinitions,
  measurementProfiles,
  measurementValues,
  orders,
  styleDirectionFileRevisions,
  styleDirectionFiles,
  vendorAssignments,
  vendors,
} from "@/db/schema";
import type { BriefExportRepository } from "@/lib/vendor-briefs/export-service";
import type { VendorBriefSources } from "@/lib/vendor-briefs/document";

export type BriefImageSource = { revisionId: string; label: string; mimeType: string; r2ObjectKey: string };

export type VendorBriefContext = {
  assignmentId: string;
  orderId: string;
  lookId: string;
  sources: VendorBriefSources;
  imageObjects: BriefImageSource[];
};

/**
 * Resolves everything a brief can show, fresh, on every request. Nothing is snapshotted: Phase 1
 * stores neither the PDF nor the payload behind it, so the preview and the export both read live
 * records and the field selection is made anew each time.
 *
 * Production notes are deliberately absent — they are internal and never leave the building.
 * Consultation notes are included, because the spec's note rules describe notes being used in a
 * vendor brief, and are opt-in per export rather than shown by default.
 */
export async function getVendorBriefContext(
  organizationId: string,
  assignmentId: string,
): Promise<VendorBriefContext | null> {
  const db = getDatabase();

  const [core] = await db
    .select({
      assignmentId: vendorAssignments.id,
      deadline: vendorAssignments.deadline,
      vendorName: vendors.name,
      vendorPhone: vendors.phone,
      clientId: clients.id,
      clientName: clients.fullName,
      orderId: orders.id,
      orderTitle: orders.title,
      lookId: looks.id,
      lookName: looks.name,
      itemId: items.id,
      itemTypeId: itemTypes.id,
      itemTypeName: itemTypes.name,
      itemLabel: items.customLabel,
      quantity: items.quantity,
    })
    .from(vendorAssignments)
    .innerJoin(vendors, eq(vendors.id, vendorAssignments.vendorId))
    .innerJoin(items, eq(items.id, vendorAssignments.itemId))
    .innerJoin(itemTypes, eq(itemTypes.id, items.itemTypeId))
    .innerJoin(looks, eq(looks.id, items.lookId))
    .innerJoin(orders, eq(orders.id, looks.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(
      and(
        eq(vendorAssignments.organizationId, organizationId),
        eq(vendorAssignments.id, assignmentId),
        isNull(vendorAssignments.archivedAt),
      ),
    )
    .limit(1);

  if (!core) return null;

  const [requirementRows, valueRows, noteRows, imageRows] = await Promise.all([
    db
      .select({
        fieldDefinitionId: measurementFieldDefinitions.id,
        label: measurementFieldDefinitions.name,
        unit: measurementFieldDefinitions.unit,
        sortOrder: measurementFieldDefinitions.sortOrder,
      })
      .from(itemTypeMeasurementRequirements)
      .innerJoin(
        measurementFieldDefinitions,
        eq(measurementFieldDefinitions.id, itemTypeMeasurementRequirements.fieldDefinitionId),
      )
      .where(
        and(
          eq(itemTypeMeasurementRequirements.organizationId, organizationId),
          eq(itemTypeMeasurementRequirements.itemTypeId, core.itemTypeId),
          isNull(itemTypeMeasurementRequirements.archivedAt),
          isNull(measurementFieldDefinitions.archivedAt),
        ),
      )
      .orderBy(asc(measurementFieldDefinitions.sortOrder)),
    db
      .select({
        fieldDefinitionId: measurementValues.fieldDefinitionId,
        value: measurementValues.value,
      })
      .from(measurementValues)
      .innerJoin(measurementProfiles, eq(measurementProfiles.id, measurementValues.measurementProfileId))
      .where(
        and(
          eq(measurementValues.organizationId, organizationId),
          eq(measurementProfiles.clientId, core.clientId),
        ),
      ),
    db
      .select({
        id: consultationNotes.id,
        body: consultationNotes.body,
        sourceLabel: consultationNoteSources.name,
        occurredAt: consultationNotes.occurredAt,
        createdAt: consultationNotes.createdAt,
      })
      .from(consultationNotes)
      .innerJoin(consultationNoteSources, eq(consultationNoteSources.id, consultationNotes.sourceId))
      .where(
        and(
          eq(consultationNotes.organizationId, organizationId),
          eq(consultationNotes.orderId, core.orderId),
          isNull(consultationNotes.archivedAt),
          // Order-wide notes plus notes for this specific Look — a note about a different Look in
          // the same Order is not about this Item.
          or(isNull(consultationNotes.lookId), eq(consultationNotes.lookId, core.lookId)),
        ),
      )
      .orderBy(asc(consultationNotes.createdAt)),
    db
      .select({
        revisionId: styleDirectionFileRevisions.id,
        mimeType: styleDirectionFileRevisions.mimeType,
        r2ObjectKey: styleDirectionFileRevisions.r2ObjectKey,
        revisionNumber: styleDirectionFileRevisions.revisionNumber,
        category: styleDirectionFiles.category,
        createdAt: styleDirectionFileRevisions.createdAt,
      })
      .from(styleDirectionFiles)
      .innerJoin(
        styleDirectionFileRevisions,
        eq(styleDirectionFileRevisions.id, styleDirectionFiles.currentRevisionId),
      )
      .where(
        and(
          eq(styleDirectionFiles.organizationId, organizationId),
          eq(styleDirectionFiles.orderId, core.orderId),
          isNull(styleDirectionFiles.archivedAt),
          or(isNull(styleDirectionFiles.lookId), eq(styleDirectionFiles.lookId, core.lookId)),
          // Only raster references can be embedded in the PDF.
          sql`${styleDirectionFileRevisions.mimeType} like 'image/%'`,
        ),
      )
      .orderBy(asc(styleDirectionFileRevisions.createdAt)),
  ]);

  const valuesByField = new Map(valueRows.map((row) => [row.fieldDefinitionId, row.value]));

  const sources: VendorBriefSources = {
    vendorName: core.vendorName,
    vendorPhone: core.vendorPhone,
    clientName: core.clientName,
    orderReference: core.orderTitle,
    lookName: core.lookName,
    itemTypeName: core.itemTypeName,
    itemLabel: core.itemLabel,
    quantity: core.quantity,
    deadline: core.deadline,
    measurements: requirementRows.map((row) => ({
      fieldDefinitionId: row.fieldDefinitionId,
      label: row.label,
      unit: row.unit,
      value: valuesByField.get(row.fieldDefinitionId) ?? null,
      required: true,
    })),
    notes: noteRows.map((row) => ({
      id: row.id,
      sourceLabel: row.sourceLabel,
      body: row.body,
      recordedOn: (row.occurredAt ?? row.createdAt).toISOString().slice(0, 10),
    })),
    images: imageRows.map((row) => ({
      revisionId: row.revisionId,
      label: `${humanizeCategory(row.category)} · revision ${row.revisionNumber}`,
      mimeType: row.mimeType,
    })),
  };

  return {
    assignmentId: core.assignmentId,
    orderId: core.orderId,
    lookId: core.lookId,
    sources,
    imageObjects: imageRows.map((row) => ({
      revisionId: row.revisionId,
      label: `${humanizeCategory(row.category)} · revision ${row.revisionNumber}`,
      mimeType: row.mimeType,
      r2ObjectKey: row.r2ObjectKey,
    })),
  };
}

function humanizeCategory(category: string): string {
  return category.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export function createBriefExportRepository(): BriefExportRepository {
  const db = getDatabase();
  return {
    async recordExport(input) {
      // Metadata and audit are written in the same transaction as each other and in the same server
      // call that produced the PDF, so an export can never be recorded without happening — or
      // happen without being recorded.
      await db.transaction(async (tx) => {
        await tx
          .update(vendorAssignments)
          .set({
            briefLastExportedAt: input.exportedAt,
            briefLastExportedByStaffId: input.actorStaffId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vendorAssignments.organizationId, input.organizationId),
              eq(vendorAssignments.id, input.assignmentId),
            ),
          );

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorStaffId,
          action: input.overrideReason ? "vendor_brief.exported_with_override" : "vendor_brief.exported",
          entityType: "vendor_assignment",
          entityId: input.assignmentId,
          summary: input.overrideReason
            ? `Exported a Vendor Brief PDF, overriding missing required measurements (${input.missingMeasurementLabels.join(", ")}). Reason: ${input.overrideReason}`
            : "Exported a Vendor Brief PDF.",
          metadata: {
            overrideReason: input.overrideReason,
            missingMeasurements: input.missingMeasurementLabels,
          },
        });
      });
    },
  };
}
