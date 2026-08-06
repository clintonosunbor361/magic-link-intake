import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  consultationNoteRevisions,
  consultationNotes,
  consultationNoteSources,
  looks,
  orders,
  staffProfiles,
} from "@/db/schema";
import type { ConsultationNoteRepository } from "@/lib/consultation-notes/service";

export function createConsultationNoteRepository(): ConsultationNoteRepository {
  const db = getDatabase();
  return {
    async orderBelongsToOrganization(organizationId, orderId) {
      const [row] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, orderId)))
        .limit(1);
      return !!row;
    },
    async lookBelongsToOrder(organizationId, orderId, lookId) {
      const [row] = await db
        .select({ id: looks.id })
        .from(looks)
        .where(and(eq(looks.organizationId, organizationId), eq(looks.orderId, orderId), eq(looks.id, lookId)))
        .limit(1);
      return !!row;
    },
    async sourceBelongsToOrganization(organizationId, sourceId) {
      const [row] = await db
        .select({ id: consultationNoteSources.id })
        .from(consultationNoteSources)
        .where(and(eq(consultationNoteSources.organizationId, organizationId), eq(consultationNoteSources.id, sourceId)))
        .limit(1);
      return !!row;
    },
    async createConsultationNote(input) {
      const [row] = await db
        .insert(consultationNotes)
        .values({
          organizationId: input.organizationId,
          orderId: input.orderId,
          lookId: input.lookId,
          sourceId: input.sourceId,
          body: input.body,
          occurredAt: input.occurredAt,
          createdByStaffId: input.createdByStaffId,
        })
        .returning({ id: consultationNotes.id });
      return row;
    },
    async getConsultationNoteForEdit(organizationId, noteId) {
      const [row] = await db
        .select({
          id: consultationNotes.id,
          version: consultationNotes.version,
          body: consultationNotes.body,
          sourceId: consultationNotes.sourceId,
          occurredAt: consultationNotes.occurredAt,
          createdByStaffId: consultationNotes.createdByStaffId,
          createdAt: consultationNotes.createdAt,
          lastEditedByStaffId: consultationNotes.lastEditedByStaffId,
          lastEditedAt: consultationNotes.lastEditedAt,
        })
        .from(consultationNotes)
        .where(and(eq(consultationNotes.organizationId, organizationId), eq(consultationNotes.id, noteId)))
        .limit(1);
      return row ?? null;
    },
    async updateConsultationNoteWithHistory(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(consultationNotes)
          .set({
            body: input.fields.body,
            sourceId: input.fields.sourceId,
            occurredAt: input.fields.occurredAt,
            lastEditedByStaffId: input.editedByStaffId,
            lastEditedAt: new Date(),
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(consultationNotes.organizationId, input.organizationId),
              eq(consultationNotes.id, input.noteId),
              eq(consultationNotes.version, input.expectedVersion),
            ),
          )
          .returning({ id: consultationNotes.id });
        if (!rows.length) throw new Error("This Consultation Note changed. Reload and try again.");

        await tx.insert(consultationNoteRevisions).values({
          organizationId: input.organizationId,
          consultationNoteId: input.noteId,
          body: input.priorSnapshot.body,
          sourceId: input.priorSnapshot.sourceId,
          occurredAt: input.priorSnapshot.occurredAt,
          authorStaffId: input.priorSnapshot.authorStaffId,
          authoredAt: input.priorSnapshot.authoredAt,
        });
      });
    },
    async getConsultationNoteLifecycle(organizationId, noteId) {
      const [row] = await db
        .select({ id: consultationNotes.id, version: consultationNotes.version })
        .from(consultationNotes)
        .where(and(eq(consultationNotes.organizationId, organizationId), eq(consultationNotes.id, noteId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(consultationNotes)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(consultationNotes.organizationId, input.organizationId),
            eq(consultationNotes.id, input.noteId),
            eq(consultationNotes.version, input.expectedVersion),
          ),
        )
        .returning({ id: consultationNotes.id });
      if (!rows.length) throw new Error("This Consultation Note changed. Reload and try again.");
    },
  };
}

export async function listConsultationNotesForOrder(organizationId: string, orderId: string) {
  const db = getDatabase();

  const noteRows = await db
    .select({
      id: consultationNotes.id,
      lookId: consultationNotes.lookId,
      lookName: looks.name,
      sourceId: consultationNotes.sourceId,
      sourceName: consultationNoteSources.name,
      body: consultationNotes.body,
      occurredAt: consultationNotes.occurredAt,
      createdByStaffId: consultationNotes.createdByStaffId,
      createdByName: staffProfiles.fullName,
      createdAt: consultationNotes.createdAt,
      lastEditedByStaffId: consultationNotes.lastEditedByStaffId,
      lastEditedAt: consultationNotes.lastEditedAt,
      version: consultationNotes.version,
      archivedAt: consultationNotes.archivedAt,
    })
    .from(consultationNotes)
    .innerJoin(consultationNoteSources, eq(consultationNoteSources.id, consultationNotes.sourceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, consultationNotes.createdByStaffId))
    .leftJoin(looks, eq(looks.id, consultationNotes.lookId))
    .where(and(eq(consultationNotes.organizationId, organizationId), eq(consultationNotes.orderId, orderId)))
    .orderBy(desc(consultationNotes.createdAt));

  const editorIds = [...new Set(noteRows.map((note) => note.lastEditedByStaffId).filter((id): id is string => Boolean(id)))];
  const editors = editorIds.length
    ? await db
        .select({ id: staffProfiles.id, fullName: staffProfiles.fullName })
        .from(staffProfiles)
        .where(inArray(staffProfiles.id, editorIds))
    : [];
  const editorNameById = new Map(editors.map((editor) => [editor.id, editor.fullName]));

  const noteIds = noteRows.map((note) => note.id);
  const revisionRows = noteIds.length
    ? await db
        .select({
          id: consultationNoteRevisions.id,
          consultationNoteId: consultationNoteRevisions.consultationNoteId,
          body: consultationNoteRevisions.body,
          sourceName: consultationNoteSources.name,
          occurredAt: consultationNoteRevisions.occurredAt,
          authorStaffId: consultationNoteRevisions.authorStaffId,
          authorName: staffProfiles.fullName,
          authoredAt: consultationNoteRevisions.authoredAt,
          createdAt: consultationNoteRevisions.createdAt,
        })
        .from(consultationNoteRevisions)
        .innerJoin(consultationNoteSources, eq(consultationNoteSources.id, consultationNoteRevisions.sourceId))
        .innerJoin(staffProfiles, eq(staffProfiles.id, consultationNoteRevisions.authorStaffId))
        .where(inArray(consultationNoteRevisions.consultationNoteId, noteIds))
        .orderBy(desc(consultationNoteRevisions.createdAt))
    : [];

  return noteRows.map((note) => ({
    ...note,
    lastEditedByName: note.lastEditedByStaffId ? editorNameById.get(note.lastEditedByStaffId) ?? null : null,
    revisions: revisionRows.filter((revision) => revision.consultationNoteId === note.id),
  }));
}
