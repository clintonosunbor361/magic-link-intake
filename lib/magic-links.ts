import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IntakeSubmissionInput } from "@/lib/intake-options";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TokenRecord = {
  hash: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  submissionId?: string;
};

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

type DemoStore = {
  tokens: Map<string, TokenRecord>;
  submissions: IntakeSubmission[];
};

const globalForStore = globalThis as typeof globalThis & {
  __kuartzIntakeDemoStore?: DemoStore;
};

const store =
  globalForStore.__kuartzIntakeDemoStore ??
  (globalForStore.__kuartzIntakeDemoStore = {
    tokens: new Map<string, TokenRecord>(),
    submissions: [],
  });

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createMagicLinkToken(now = Date.now()) {
  const token = generateToken();
  const hash = hashToken(token);

  store.tokens.set(hash, {
    hash,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
    used: false,
  });

  return {
    token,
    hash,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
}

export function verifyToken(token: string, now = Date.now()): boolean {
  const record = store.tokens.get(hashToken(token));

  return Boolean(record && !record.used && record.expiresAt > now);
}

export function consumeTokenWithSubmission(
  token: string,
  submission: IntakeSubmissionInput,
  now = Date.now(),
) {
  const hash = hashToken(token);
  const record = store.tokens.get(hash);

  if (!record || record.used || record.expiresAt <= now) {
    return { ok: false as const };
  }

  const savedSubmission: IntakeSubmission = {
    ...submission,
    id: randomUUID(),
    tokenHash: hash,
    submittedAt: now,
  };

  record.used = true;
  record.usedAt = now;
  record.submissionId = savedSubmission.id;
  store.submissions.unshift(savedSubmission);

  return { ok: true as const, submission: savedSubmission };
}

export function listMagicLinks(now = Date.now()): MagicLinkSummary[] {
  return Array.from(store.tokens.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((record) => ({
      id: record.hash,
      hashPreview: `${record.hash.slice(0, 10)}...`,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      status: getStatus(record, now),
    }));
}

export function listSubmissions(): IntakeSubmission[] {
  return [...store.submissions];
}

function getStatus(record: TokenRecord, now: number): LinkStatus {
  if (record.used) {
    return "Used";
  }

  if (record.expiresAt <= now) {
    return "Expired";
  }

  return "Active";
}
