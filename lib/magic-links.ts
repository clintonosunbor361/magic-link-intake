import "server-only";

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { enquiries, magicLinkTokens } from "@/db/schema";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/enquiries/duplicate-match";
import type { IntakeSubmissionInput } from "@/lib/intake-options";
import { generateToken, hashToken } from "@/lib/tokens";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type LinkStatus = "Active" | "Used" | "Expired";

export type MagicLinkSummary = {
  id: string;
  hashPreview: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  status: LinkStatus;
};

export type IntakeSubmission = IntakeSubmissionInput & {
  id: string;
  tokenHash: string;
  submittedAt: number;
};

export async function createMagicLinkToken(
  actor: { organizationId: string; generatedByStaffId: string },
  now = Date.now(),
) {
  const token = generateToken();
  const hash = hashToken(token);
  const expiresAt = new Date(now + TOKEN_TTL_MS);

  await getDatabase().insert(magicLinkTokens).values({
    organizationId: actor.organizationId,
    generatedByStaffId: actor.generatedByStaffId,
    tokenHash: hash,
    expiresAt,
  });

  return { token, hash, createdAt: now, expiresAt: expiresAt.getTime() };
}

export async function verifyToken(token: string, now = Date.now()): Promise<boolean> {
  const hash = hashToken(token);
  const [record] = await getDatabase()
    .select({ consumedAt: magicLinkTokens.consumedAt, expiresAt: magicLinkTokens.expiresAt })
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, hash))
    .limit(1);

  return Boolean(record && !record.consumedAt && record.expiresAt.getTime() > now);
}

export async function consumeTokenWithSubmission(
  token: string,
  submission: IntakeSubmissionInput,
  now = Date.now(),
) {
  const hash = hashToken(token);
  const db = getDatabase();

  return db.transaction(async (tx) => {
    const [tokenRow] = await tx
      .select({ id: magicLinkTokens.id, organizationId: magicLinkTokens.organizationId })
      .from(magicLinkTokens)
      .where(
        and(
          eq(magicLinkTokens.tokenHash, hash),
          isNull(magicLinkTokens.consumedAt),
          gt(magicLinkTokens.expiresAt, new Date(now)),
        ),
      )
      .for("update");

    if (!tokenRow) return { ok: false as const };

    const [enquiryRow] = await tx
      .insert(enquiries)
      .values({
        organizationId: tokenRow.organizationId,
        channel: "external_form",
        fullName: submission.fullName,
        nameNormalized: normalizeName(submission.fullName),
        primaryPhone: submission.primaryPhone,
        primaryPhoneNormalized: normalizePhone(submission.primaryPhone),
        whatsappSameAsPrimary: submission.whatsappSameAsPrimary,
        whatsappPhone: submission.whatsappPhone,
        email: submission.email || null,
        emailNormalized: submission.email ? normalizeEmail(submission.email) : null,
        preferredContactChannel: submission.preferredContactChannel,
        eventType: submission.eventType,
        budgetRange: submission.budgetRange,
        brief: submission.brief,
      })
      .returning({ id: enquiries.id });

    await tx
      .update(magicLinkTokens)
      .set({ consumedAt: new Date(now), enquiryId: enquiryRow.id })
      .where(eq(magicLinkTokens.id, tokenRow.id));

    const savedSubmission: IntakeSubmission = {
      ...submission,
      id: enquiryRow.id,
      tokenHash: hash,
      submittedAt: now,
    };

    return { ok: true as const, submission: savedSubmission };
  });
}

export async function listMagicLinks(organizationId: string, now = Date.now()): Promise<MagicLinkSummary[]> {
  const rows = await getDatabase()
    .select({
      id: magicLinkTokens.id,
      tokenHash: magicLinkTokens.tokenHash,
      createdAt: magicLinkTokens.createdAt,
      expiresAt: magicLinkTokens.expiresAt,
      consumedAt: magicLinkTokens.consumedAt,
    })
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.organizationId, organizationId))
    .orderBy(desc(magicLinkTokens.createdAt));

  return rows.map((row) => ({
    id: row.id,
    hashPreview: `${row.tokenHash.slice(0, 10)}...`,
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
    usedAt: row.consumedAt?.getTime(),
    status: getStatus(row, now),
  }));
}

function getStatus(row: { consumedAt: Date | null; expiresAt: Date }, now: number): LinkStatus {
  if (row.consumedAt) return "Used";
  if (row.expiresAt.getTime() <= now) return "Expired";
  return "Active";
}
