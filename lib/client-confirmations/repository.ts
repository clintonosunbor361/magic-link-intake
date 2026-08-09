import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEntries, clientConfirmations, fittingSessions, measurementProfiles, orders } from "@/db/schema";
import { hashToken } from "@/lib/tokens";
import type { ClientConfirmationRepository, ClientConfirmationSubjectType } from "@/lib/client-confirmations/service";
import type { ClientConfirmationDecision, ClientConfirmationDecisionRepository } from "@/lib/client-confirmations/decision-service";

const SUBJECT_AUDIT_LABELS: Record<ClientConfirmationSubjectType, string> = {
  measurement_profile: "measurement",
  order_detail: "order detail",
  fitting_session: "fitting",
};

function auditActionForDecision(decision: ClientConfirmationDecision): string {
  return decision === "confirmed" ? "client_confirmation.confirmed" : "client_confirmation.correction_requested";
}

export function createClientConfirmationRepository(): ClientConfirmationRepository {
  const db = getDatabase();
  return {
    async subjectExists(organizationId, subjectType, subjectId) {
      if (subjectType === "measurement_profile") {
        const [row] = await db
          .select({ id: measurementProfiles.id })
          .from(measurementProfiles)
          .where(and(eq(measurementProfiles.organizationId, organizationId), eq(measurementProfiles.id, subjectId)))
          .limit(1);
        return !!row;
      }
      if (subjectType === "fitting_session") {
        const [row] = await db
          .select({ id: fittingSessions.id })
          .from(fittingSessions)
          .where(and(eq(fittingSessions.organizationId, organizationId), eq(fittingSessions.id, subjectId)))
          .limit(1);
        return !!row;
      }
      const [row] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.organizationId, organizationId), eq(orders.id, subjectId)))
        .limit(1);
      return !!row;
    },
    async createConfirmationAndInvalidatePrior(input) {
      return db.transaction(async (tx) => {
        await tx
          .update(clientConfirmations)
          .set({ supersededAt: new Date() })
          .where(
            and(
              eq(clientConfirmations.organizationId, input.organizationId),
              eq(clientConfirmations.subjectType, input.subjectType),
              eq(clientConfirmations.subjectId, input.subjectId),
              isNull(clientConfirmations.completedAt),
              isNull(clientConfirmations.supersededAt),
              gt(clientConfirmations.expiresAt, new Date()),
            ),
          );

        const [confirmation] = await tx
          .insert(clientConfirmations)
          .values({
            organizationId: input.organizationId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            tokenHash: input.tokenHash,
            createdByStaffId: input.createdByStaffId,
            expiresAt: input.expiresAt,
          })
          .returning({ id: clientConfirmations.id });

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.createdByStaffId,
          action: "client_confirmation.created",
          entityType: "client_confirmation",
          entityId: confirmation.id,
          summary: `Sent a ${SUBJECT_AUDIT_LABELS[input.subjectType]} confirmation link to the client.`,
          metadata: { subjectType: input.subjectType, subjectId: input.subjectId },
        });

        return { confirmationId: confirmation.id };
      });
    },
    async getConfirmationForDelivery(organizationId, confirmationId) {
      const [row] = await db
        .select({ id: clientConfirmations.id, tokenHash: clientConfirmations.tokenHash })
        .from(clientConfirmations)
        .where(and(eq(clientConfirmations.organizationId, organizationId), eq(clientConfirmations.id, confirmationId)))
        .limit(1);
      return row ?? null;
    },
    async markDelivered(input) {
      await db.transaction(async (tx) => {
        await tx
          .update(clientConfirmations)
          .set({ deliveryMethod: input.method, deliveredAt: new Date() })
          .where(
            and(
              eq(clientConfirmations.organizationId, input.organizationId),
              eq(clientConfirmations.id, input.confirmationId),
            ),
          );

        await tx.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: "client_confirmation.sent",
          entityType: "client_confirmation",
          entityId: input.confirmationId,
          summary:
            input.method === "email"
              ? `Sent the confirmation link by email to ${input.recipientEmail}.`
              : "Copied the confirmation link.",
          metadata: input.method === "email" ? { method: input.method, recipientEmail: input.recipientEmail } : { method: input.method },
        });
      });
    },
  };
}

export function createClientConfirmationDecisionRepository(): ClientConfirmationDecisionRepository {
  const db = getDatabase();
  return {
    async applyDecisionAndMaybeComplete(input) {
      return db.transaction(async (tx) => {
        const [confirmation] = await tx
          .select({
            id: clientConfirmations.id,
            organizationId: clientConfirmations.organizationId,
            expiresAt: clientConfirmations.expiresAt,
            supersededAt: clientConfirmations.supersededAt,
          })
          .from(clientConfirmations)
          .where(eq(clientConfirmations.tokenHash, input.tokenHash))
          .for("update");

        if (!confirmation || confirmation.supersededAt || confirmation.expiresAt <= new Date()) {
          return { ok: false as const, reason: "inactive" as const };
        }

        const [updated] = await tx
          .update(clientConfirmations)
          .set({
            decisionStatus: input.decision,
            decisionComment: input.comment,
            decidedAt: new Date(),
            completedAt: new Date(),
          })
          .where(and(eq(clientConfirmations.id, confirmation.id), eq(clientConfirmations.decisionStatus, "pending")))
          .returning({ id: clientConfirmations.id });

        if (!updated) return { ok: false as const, reason: "inactive" as const };

        await tx.insert(auditEntries).values({
          organizationId: confirmation.organizationId,
          actorId: null,
          action: auditActionForDecision(input.decision),
          entityType: "client_confirmation",
          entityId: confirmation.id,
          summary: `A client ${input.decision === "confirmed" ? "confirmed" : "requested a correction to"} a confirmation.`,
          metadata: { comment: input.comment },
        });

        return { ok: true as const };
      });
    },
  };
}

export type ClientConfirmationStatus = "Active" | "Completed" | "Superseded" | "Expired";

export function getClientConfirmationStatus(
  confirmation: { completedAt: Date | null; supersededAt: Date | null; expiresAt: Date },
  now = new Date(),
): ClientConfirmationStatus {
  if (confirmation.completedAt) return "Completed";
  if (confirmation.supersededAt) return "Superseded";
  if (confirmation.expiresAt <= now) return "Expired";
  return "Active";
}

export async function listConfirmationsForSubject(
  organizationId: string,
  subjectType: ClientConfirmationSubjectType,
  subjectId: string,
) {
  const db = getDatabase();
  const rows = await db
    .select({
      id: clientConfirmations.id,
      decisionStatus: clientConfirmations.decisionStatus,
      decisionComment: clientConfirmations.decisionComment,
      expiresAt: clientConfirmations.expiresAt,
      completedAt: clientConfirmations.completedAt,
      supersededAt: clientConfirmations.supersededAt,
      deliveryMethod: clientConfirmations.deliveryMethod,
      deliveredAt: clientConfirmations.deliveredAt,
      createdAt: clientConfirmations.createdAt,
    })
    .from(clientConfirmations)
    .where(
      and(
        eq(clientConfirmations.organizationId, organizationId),
        eq(clientConfirmations.subjectType, subjectType),
        eq(clientConfirmations.subjectId, subjectId),
      ),
    )
    .orderBy(clientConfirmations.createdAt);

  return rows.map((row) => ({ ...row, status: getClientConfirmationStatus(row) }));
}

export type ClientConfirmationView = {
  id: string;
  organizationId: string;
  subjectType: ClientConfirmationSubjectType;
  subjectId: string;
  status: ClientConfirmationStatus;
  decisionStatus: "pending" | "confirmed" | "correction_requested";
  decisionComment: string | null;
};

// No organizationId scoping — the token itself is the credential here (this page is reached by
// an unauthenticated client, not a signed-in staff session).
export async function getConfirmationForToken(token: string): Promise<ClientConfirmationView | null> {
  const db = getDatabase();
  const [row] = await db
    .select({
      id: clientConfirmations.id,
      organizationId: clientConfirmations.organizationId,
      subjectType: clientConfirmations.subjectType,
      subjectId: clientConfirmations.subjectId,
      decisionStatus: clientConfirmations.decisionStatus,
      decisionComment: clientConfirmations.decisionComment,
      completedAt: clientConfirmations.completedAt,
      supersededAt: clientConfirmations.supersededAt,
      expiresAt: clientConfirmations.expiresAt,
    })
    .from(clientConfirmations)
    .where(eq(clientConfirmations.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    status: getClientConfirmationStatus(row),
    decisionStatus: row.decisionStatus,
    decisionComment: row.decisionComment,
  };
}
