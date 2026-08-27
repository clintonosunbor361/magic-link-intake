import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  clients,
  measurementFieldDefinitions,
  measurementProfileAttachments,
  measurementProfiles,
  measurementValueRevisions,
  measurementValues,
  staffProfiles,
} from "@/db/schema";
import { compressImage } from "@/lib/storage/image";
import { deletePrivateObject, putPrivateObject } from "@/lib/storage/r2";
import type { MeasurementProfileRepository } from "@/lib/measurement-profiles/service";
import type {
  MeasurementAttachmentStorage,
  MeasurementProfileAttachmentRepository,
} from "@/lib/measurement-profiles/attachments-service";

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
  const code = cause?.code ?? (error as { code?: string } | undefined)?.code;
  return code === "23505";
}

export function createMeasurementProfileRepository(): MeasurementProfileRepository {
  const db = getDatabase();
  return {
    async clientBelongsToOrganization(organizationId, clientId) {
      const [row] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)))
        .limit(1);
      return !!row;
    },
    async measurementProfileIsEditable(organizationId, measurementProfileId) {
      const [row] = await db
        .select({ id: measurementProfiles.id })
        .from(measurementProfiles)
        .where(
          and(
            eq(measurementProfiles.organizationId, organizationId),
            eq(measurementProfiles.id, measurementProfileId),
            isNull(measurementProfiles.archivedAt),
          ),
        )
        .limit(1);
      return !!row;
    },
    async fieldDefinitionBelongsToOrganization(organizationId, fieldDefinitionId) {
      const [row] = await db
        .select({ id: measurementFieldDefinitions.id })
        .from(measurementFieldDefinitions)
        .where(
          and(
            eq(measurementFieldDefinitions.organizationId, organizationId),
            eq(measurementFieldDefinitions.id, fieldDefinitionId),
          ),
        )
        .limit(1);
      return !!row;
    },
    async getOrCreateMeasurementProfile(organizationId, clientId) {
      const [inserted] = await db
        .insert(measurementProfiles)
        .values({ organizationId, clientId })
        .onConflictDoNothing({ target: [measurementProfiles.organizationId, measurementProfiles.clientId] })
        .returning({
          id: measurementProfiles.id,
          version: measurementProfiles.version,
          archivedAt: measurementProfiles.archivedAt,
        });
      if (inserted) return inserted;

      const [existing] = await db
        .select({
          id: measurementProfiles.id,
          version: measurementProfiles.version,
          archivedAt: measurementProfiles.archivedAt,
        })
        .from(measurementProfiles)
        .where(and(eq(measurementProfiles.organizationId, organizationId), eq(measurementProfiles.clientId, clientId)))
        .limit(1);
      if (!existing) throw new Error("Measurement profile could not be created.");
      return existing;
    },
    async getMeasurementValueForEdit(organizationId, measurementProfileId, fieldDefinitionId) {
      const [row] = await db
        .select({ id: measurementValues.id, version: measurementValues.version, value: measurementValues.value })
        .from(measurementValues)
        .where(
          and(
            eq(measurementValues.organizationId, organizationId),
            eq(measurementValues.measurementProfileId, measurementProfileId),
            eq(measurementValues.fieldDefinitionId, fieldDefinitionId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async createMeasurementValueWithHistory(input) {
      try {
        return await db.transaction(async (tx) => {
          const [value] = await tx
            .insert(measurementValues)
            .values({
              organizationId: input.organizationId,
              measurementProfileId: input.measurementProfileId,
              fieldDefinitionId: input.fieldDefinitionId,
              value: input.value,
              createdByStaffId: input.staffId,
            })
            .returning({ id: measurementValues.id, version: measurementValues.version });

          await tx.insert(measurementValueRevisions).values({
            organizationId: input.organizationId,
            measurementValueId: value.id,
            fieldDefinitionId: input.fieldDefinitionId,
            previousValue: null,
            newValue: input.value,
            changedByStaffId: input.staffId,
            note: input.note,
          });

          return value;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error("This field changed. Reload and try again.");
        throw error;
      }
    },
    async updateMeasurementValueWithHistory(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(measurementValues)
          .set({
            value: input.value,
            lastEditedByStaffId: input.staffId,
            lastEditedAt: new Date(),
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(measurementValues.organizationId, input.organizationId),
              eq(measurementValues.id, input.measurementValueId),
              eq(measurementValues.version, input.expectedVersion),
            ),
          )
          .returning({ id: measurementValues.id });
        if (!rows.length) throw new Error("This field changed. Reload and try again.");

        await tx.insert(measurementValueRevisions).values({
          organizationId: input.organizationId,
          measurementValueId: input.measurementValueId,
          fieldDefinitionId: input.fieldDefinitionId,
          previousValue: input.previousValue,
          newValue: input.value,
          changedByStaffId: input.staffId,
          note: input.note,
        });
      });
    },
    async getMeasurementProfileLifecycle(organizationId, measurementProfileId) {
      const [row] = await db
        .select({ id: measurementProfiles.id, version: measurementProfiles.version })
        .from(measurementProfiles)
        .where(and(eq(measurementProfiles.organizationId, organizationId), eq(measurementProfiles.id, measurementProfileId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(measurementProfiles)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(measurementProfiles.organizationId, input.organizationId),
            eq(measurementProfiles.id, input.measurementProfileId),
            eq(measurementProfiles.version, input.expectedVersion),
          ),
        )
        .returning({ id: measurementProfiles.id });
      if (!rows.length) throw new Error("This measurement profile changed. Reload and try again.");
    },
  };
}

export function createMeasurementProfileAttachmentRepository(): MeasurementProfileAttachmentRepository {
  const db = getDatabase();
  return {
    async measurementProfileBelongsToOrganization(organizationId, measurementProfileId) {
      const [row] = await db
        .select({ id: measurementProfiles.id })
        .from(measurementProfiles)
        .where(and(eq(measurementProfiles.organizationId, organizationId), eq(measurementProfiles.id, measurementProfileId)))
        .limit(1);
      return !!row;
    },
    async createAttachment(input) {
      const [row] = await db
        .insert(measurementProfileAttachments)
        .values({
          organizationId: input.organizationId,
          measurementProfileId: input.measurementProfileId,
          r2ObjectKey: input.r2ObjectKey,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          uploadedByStaffId: input.uploadedByStaffId,
        })
        .returning({ id: measurementProfileAttachments.id });
      return row;
    },
    async getAttachmentLifecycle(organizationId, attachmentId) {
      const [row] = await db
        .select({ id: measurementProfileAttachments.id, version: measurementProfileAttachments.version })
        .from(measurementProfileAttachments)
        .where(
          and(
            eq(measurementProfileAttachments.organizationId, organizationId),
            eq(measurementProfileAttachments.id, attachmentId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(measurementProfileAttachments)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(measurementProfileAttachments.organizationId, input.organizationId),
            eq(measurementProfileAttachments.id, input.attachmentId),
            eq(measurementProfileAttachments.version, input.expectedVersion),
          ),
        )
        .returning({ id: measurementProfileAttachments.id });
      if (!rows.length) throw new Error("This attachment changed. Reload and try again.");
    },
  };
}

export function createMeasurementAttachmentStorage(): MeasurementAttachmentStorage {
  return { putObject: putPrivateObject, deleteObject: deletePrivateObject, compressImage };
}

export async function getMeasurementProfileClient(organizationId: string, measurementProfileId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({ clientId: measurementProfiles.clientId })
    .from(measurementProfiles)
    .where(and(eq(measurementProfiles.organizationId, organizationId), eq(measurementProfiles.id, measurementProfileId)))
    .limit(1);
  return row ?? null;
}

export async function listMeasurementProfileSnapshot(organizationId: string, measurementProfileId: string) {
  const db = getDatabase();

  const fieldRows = await db
    .select({
      fieldId: measurementFieldDefinitions.id,
      fieldName: measurementFieldDefinitions.name,
      unit: measurementFieldDefinitions.unit,
      valueId: measurementValues.id,
      value: measurementValues.value,
      version: measurementValues.version,
      createdByStaffId: measurementValues.createdByStaffId,
      createdAt: measurementValues.createdAt,
      lastEditedByStaffId: measurementValues.lastEditedByStaffId,
      lastEditedAt: measurementValues.lastEditedAt,
    })
    .from(measurementFieldDefinitions)
    .leftJoin(
      measurementValues,
      and(
        eq(measurementValues.fieldDefinitionId, measurementFieldDefinitions.id),
        eq(measurementValues.measurementProfileId, measurementProfileId),
      ),
    )
    .where(and(eq(measurementFieldDefinitions.organizationId, organizationId), isNull(measurementFieldDefinitions.archivedAt)))
    .orderBy(measurementFieldDefinitions.sortOrder);

  const valueIds = fieldRows.map((row) => row.valueId).filter((id): id is string => Boolean(id));
  const revisionRows = valueIds.length
    ? await db
        .select({
          id: measurementValueRevisions.id,
          measurementValueId: measurementValueRevisions.measurementValueId,
          previousValue: measurementValueRevisions.previousValue,
          newValue: measurementValueRevisions.newValue,
          changedByStaffId: measurementValueRevisions.changedByStaffId,
          note: measurementValueRevisions.note,
          createdAt: measurementValueRevisions.createdAt,
        })
        .from(measurementValueRevisions)
        .where(inArray(measurementValueRevisions.measurementValueId, valueIds))
        .orderBy(desc(measurementValueRevisions.createdAt))
    : [];

  const staffIds = [
    ...new Set(
      [
        ...fieldRows.flatMap((row) => [row.createdByStaffId, row.lastEditedByStaffId]),
        ...revisionRows.map((row) => row.changedByStaffId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffRows = staffIds.length
    ? await db.select({ id: staffProfiles.id, fullName: staffProfiles.fullName }).from(staffProfiles).where(inArray(staffProfiles.id, staffIds))
    : [];
  const staffNameById = new Map(staffRows.map((row) => [row.id, row.fullName]));

  return fieldRows.map((row) => ({
    fieldId: row.fieldId,
    fieldName: row.fieldName,
    unit: row.unit,
    valueId: row.valueId,
    value: row.value,
    version: row.version ?? 0,
    createdByName: row.createdByStaffId ? staffNameById.get(row.createdByStaffId) ?? null : null,
    lastEditedByName: row.lastEditedByStaffId ? staffNameById.get(row.lastEditedByStaffId) ?? null : null,
    lastEditedAt: row.lastEditedAt,
    revisions: row.valueId
      ? revisionRows
          .filter((revision) => revision.measurementValueId === row.valueId)
          .map((revision) => ({ ...revision, changedByName: staffNameById.get(revision.changedByStaffId) ?? null }))
      : [],
  }));
}

export async function listMeasurementProfileAttachments(organizationId: string, measurementProfileId: string) {
  const db = getDatabase();
  return db
    .select({
      id: measurementProfileAttachments.id,
      r2ObjectKey: measurementProfileAttachments.r2ObjectKey,
      mimeType: measurementProfileAttachments.mimeType,
      version: measurementProfileAttachments.version,
      archivedAt: measurementProfileAttachments.archivedAt,
      createdAt: measurementProfileAttachments.createdAt,
    })
    .from(measurementProfileAttachments)
    .where(
      and(
        eq(measurementProfileAttachments.organizationId, organizationId),
        eq(measurementProfileAttachments.measurementProfileId, measurementProfileId),
      ),
    )
    .orderBy(desc(measurementProfileAttachments.createdAt));
}
