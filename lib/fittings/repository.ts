import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  clients,
  fittingSessionHistory,
  fittingSessionNotes,
  fittingSessions,
  looks,
  orders,
  staffProfiles,
} from "@/db/schema";
import type { FittingSessionRepository } from "@/lib/fittings/service";
import { isOpenFittingStatus, type FittingSessionStatus } from "@/lib/fittings/fitting";

export function createFittingSessionRepository(): FittingSessionRepository {
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
    async createSession(input) {
      // The session and its opening history row are one transaction, so a Fitting always has a
      // record of when it was first booked even after it is later moved.
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(fittingSessions)
          .values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            lookId: input.lookId,
            scheduledAt: input.scheduledAt,
            location: input.location,
            scheduledByStaffId: input.actorStaffId,
          })
          .returning({ id: fittingSessions.id });

        await tx.insert(fittingSessionHistory).values({
          organizationId: input.organizationId,
          fittingSessionId: row.id,
          previousStatus: null,
          newStatus: "scheduled",
          previousScheduledAt: null,
          newScheduledAt: input.scheduledAt,
          note: null,
          changedByStaffId: input.actorStaffId,
        });

        return row;
      });
    },
    async getSession(organizationId, sessionId) {
      const [row] = await db
        .select({
          id: fittingSessions.id,
          orderId: fittingSessions.orderId,
          status: fittingSessions.status,
          scheduledAt: fittingSessions.scheduledAt,
          version: fittingSessions.version,
          archivedAt: fittingSessions.archivedAt,
        })
        .from(fittingSessions)
        .where(and(eq(fittingSessions.organizationId, organizationId), eq(fittingSessions.id, sessionId)))
        .limit(1);
      return row ?? null;
    },
    async rescheduleSession(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(fittingSessions)
          .set({
            scheduledAt: input.scheduledAt,
            location: input.location,
            version: input.nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(fittingSessions.organizationId, input.organizationId),
              eq(fittingSessions.id, input.sessionId),
              eq(fittingSessions.version, input.expectedVersion),
            ),
          )
          .returning({ id: fittingSessions.id });
        if (!rows.length) throw new Error("This Fitting changed. Reload and try again.");

        // Because the reschedule overwrites scheduledAt, this row is the only place the previous
        // date survives.
        await tx.insert(fittingSessionHistory).values({
          organizationId: input.organizationId,
          fittingSessionId: input.sessionId,
          previousStatus: input.status,
          newStatus: input.status,
          previousScheduledAt: input.previousScheduledAt,
          newScheduledAt: input.scheduledAt,
          note: input.note,
          changedByStaffId: input.actorStaffId,
        });
      });
    },
    async changeStatus(input) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(fittingSessions)
          .set({ status: input.newStatus, version: input.nextVersion, updatedAt: new Date() })
          .where(
            and(
              eq(fittingSessions.organizationId, input.organizationId),
              eq(fittingSessions.id, input.sessionId),
              eq(fittingSessions.version, input.expectedVersion),
            ),
          )
          .returning({ id: fittingSessions.id });
        if (!rows.length) throw new Error("This Fitting changed. Reload and try again.");

        await tx.insert(fittingSessionHistory).values({
          organizationId: input.organizationId,
          fittingSessionId: input.sessionId,
          previousStatus: input.previousStatus,
          newStatus: input.newStatus,
          previousScheduledAt: input.scheduledAt,
          newScheduledAt: input.scheduledAt,
          note: input.note,
          changedByStaffId: input.actorStaffId,
        });
      });
    },
    async updateClientSummary(input) {
      const rows = await db
        .update(fittingSessions)
        .set({ clientSummary: input.clientSummary, version: input.nextVersion, updatedAt: new Date() })
        .where(
          and(
            eq(fittingSessions.organizationId, input.organizationId),
            eq(fittingSessions.id, input.sessionId),
            eq(fittingSessions.version, input.expectedVersion),
          ),
        )
        .returning({ id: fittingSessions.id });
      if (!rows.length) throw new Error("This Fitting changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(fittingSessions)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(fittingSessions.organizationId, input.organizationId),
            eq(fittingSessions.id, input.sessionId),
            eq(fittingSessions.version, input.expectedVersion),
          ),
        )
        .returning({ id: fittingSessions.id });
      if (!rows.length) throw new Error("This Fitting changed. Reload and try again.");
    },
    async addNote(input) {
      const [row] = await db
        .insert(fittingSessionNotes)
        .values({
          organizationId: input.organizationId,
          fittingSessionId: input.sessionId,
          note: input.note,
          createdByStaffId: input.actorStaffId,
        })
        .returning({ id: fittingSessionNotes.id });
      return row;
    },
  };
}

export type FittingSessionRow = {
  id: string;
  orderId: string;
  lookId: string | null;
  lookName: string | null;
  scheduledAt: Date;
  location: string;
  status: FittingSessionStatus;
  clientSummary: string;
  version: number;
  archivedAt: Date | null;
};

export async function listFittingSessionsForOrder(
  organizationId: string,
  orderId: string,
): Promise<FittingSessionRow[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      id: fittingSessions.id,
      orderId: fittingSessions.orderId,
      lookId: fittingSessions.lookId,
      lookName: looks.name,
      scheduledAt: fittingSessions.scheduledAt,
      location: fittingSessions.location,
      status: fittingSessions.status,
      clientSummary: fittingSessions.clientSummary,
      version: fittingSessions.version,
      archivedAt: fittingSessions.archivedAt,
    })
    .from(fittingSessions)
    .leftJoin(looks, eq(looks.id, fittingSessions.lookId))
    .where(and(eq(fittingSessions.organizationId, organizationId), eq(fittingSessions.orderId, orderId)))
    .orderBy(asc(fittingSessions.scheduledAt));

  return rows;
}

/** Live Fittings on this Order that have not reached a terminal state. */
export async function listOpenFittingSessions(organizationId: string, orderId: string) {
  const rows = await listFittingSessionsForOrder(organizationId, orderId);
  return rows.filter((row) => !row.archivedAt && isOpenFittingStatus(row.status));
}

export async function getFittingSessionDetail(organizationId: string, sessionId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({
      id: fittingSessions.id,
      orderId: fittingSessions.orderId,
      orderTitle: orders.title,
      lookId: fittingSessions.lookId,
      lookName: looks.name,
      scheduledAt: fittingSessions.scheduledAt,
      location: fittingSessions.location,
      status: fittingSessions.status,
      clientSummary: fittingSessions.clientSummary,
      version: fittingSessions.version,
      archivedAt: fittingSessions.archivedAt,
    })
    .from(fittingSessions)
    .innerJoin(orders, eq(orders.id, fittingSessions.orderId))
    .leftJoin(looks, eq(looks.id, fittingSessions.lookId))
    .where(and(eq(fittingSessions.organizationId, organizationId), eq(fittingSessions.id, sessionId)))
    .limit(1);
  return row ?? null;
}

export async function listFittingNotes(organizationId: string, sessionId: string) {
  const db = getDatabase();
  return db
    .select({
      id: fittingSessionNotes.id,
      note: fittingSessionNotes.note,
      createdAt: fittingSessionNotes.createdAt,
      createdByName: staffProfiles.fullName,
    })
    .from(fittingSessionNotes)
    .innerJoin(staffProfiles, eq(staffProfiles.id, fittingSessionNotes.createdByStaffId))
    .where(
      and(
        eq(fittingSessionNotes.organizationId, organizationId),
        eq(fittingSessionNotes.fittingSessionId, sessionId),
      ),
    )
    .orderBy(desc(fittingSessionNotes.createdAt));
}

export async function listFittingHistory(organizationId: string, sessionId: string) {
  const db = getDatabase();
  return db
    .select({
      id: fittingSessionHistory.id,
      previousStatus: fittingSessionHistory.previousStatus,
      newStatus: fittingSessionHistory.newStatus,
      previousScheduledAt: fittingSessionHistory.previousScheduledAt,
      newScheduledAt: fittingSessionHistory.newScheduledAt,
      note: fittingSessionHistory.note,
      createdAt: fittingSessionHistory.createdAt,
      changedByName: staffProfiles.fullName,
    })
    .from(fittingSessionHistory)
    .innerJoin(staffProfiles, eq(staffProfiles.id, fittingSessionHistory.changedByStaffId))
    .where(
      and(
        eq(fittingSessionHistory.organizationId, organizationId),
        eq(fittingSessionHistory.fittingSessionId, sessionId),
      ),
    )
    .orderBy(desc(fittingSessionHistory.createdAt));
}

/** The client-facing payload for a Fitting confirmation link. Internal notes are never included. */
export async function getFittingConfirmationContent(organizationId: string, sessionId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({
      clientFullName: clients.fullName,
      orderTitle: orders.title,
      lookName: looks.name,
      scheduledAt: fittingSessions.scheduledAt,
      clientSummary: fittingSessions.clientSummary,
    })
    .from(fittingSessions)
    .innerJoin(orders, eq(orders.id, fittingSessions.orderId))
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .leftJoin(looks, eq(looks.id, fittingSessions.lookId))
    .where(
      and(
        eq(fittingSessions.organizationId, organizationId),
        eq(fittingSessions.id, sessionId),
        isNull(fittingSessions.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}
