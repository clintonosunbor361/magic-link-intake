import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { IntakeSubmissionInput } from "@/lib/intake-options";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_RECORD_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const KEY_PREFIX = "kuartz:intake";
const TOKEN_LIST_KEY = `${KEY_PREFIX}:tokens`;
const SUBMISSION_LIST_KEY = `${KEY_PREFIX}:submissions`;
const TOKEN_LIST_LIMIT = 100;
const SUBMISSION_LIST_LIMIT = 100;

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

let redisClient: Redis | null | undefined;

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createMagicLinkToken(now = Date.now()) {
  const token = generateToken();
  const hash = hashToken(token);
  const record: TokenRecord = {
    hash,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
    used: false,
  };

  const redis = getRedisClient();

  if (redis) {
    await redis.set(tokenKey(hash), record, {
      ex: TOKEN_RECORD_RETENTION_SECONDS,
    });
    await redis.lpush(TOKEN_LIST_KEY, hash);
    await redis.ltrim(TOKEN_LIST_KEY, 0, TOKEN_LIST_LIMIT - 1);
  } else {
    store.tokens.set(hash, record);
  }

  return {
    token,
    hash,
    createdAt: now,
    expiresAt: record.expiresAt,
  };
}

export async function verifyToken(token: string, now = Date.now()): Promise<boolean> {
  const record = await getTokenRecord(hashToken(token));

  return Boolean(record && !record.used && record.expiresAt > now);
}

export async function consumeTokenWithSubmission(
  token: string,
  submission: IntakeSubmissionInput,
  now = Date.now(),
) {
  const hash = hashToken(token);
  const redis = getRedisClient();
  const record = await getTokenRecord(hash);

  if (!record || record.used || record.expiresAt <= now) {
    return { ok: false as const };
  }

  if (redis) {
    const lockWasSet = await redis.set(consumedKey(hash), "1", {
      ex: TOKEN_RECORD_RETENTION_SECONDS,
      nx: true,
    });

    if (!lockWasSet) {
      return { ok: false as const };
    }
  }

  const savedSubmission: IntakeSubmission = {
    ...submission,
    id: randomUUID(),
    tokenHash: hash,
    submittedAt: now,
  };

  const usedRecord: TokenRecord = {
    ...record,
    used: true,
    usedAt: now,
    submissionId: savedSubmission.id,
  };

  if (redis) {
    await redis.set(tokenKey(hash), usedRecord, {
      ex: TOKEN_RECORD_RETENTION_SECONDS,
    });
    await redis.set(submissionKey(savedSubmission.id), savedSubmission);
    await redis.lpush(SUBMISSION_LIST_KEY, savedSubmission.id);
    await redis.ltrim(SUBMISSION_LIST_KEY, 0, SUBMISSION_LIST_LIMIT - 1);
  } else {
    store.tokens.set(hash, usedRecord);
    store.submissions.unshift(savedSubmission);
  }

  return { ok: true as const, submission: savedSubmission };
}

export async function listMagicLinks(now = Date.now()): Promise<MagicLinkSummary[]> {
  const redis = getRedisClient();

  if (redis) {
    const hashes = await redis.lrange<string>(TOKEN_LIST_KEY, 0, TOKEN_LIST_LIMIT - 1);
    const uniqueHashes = Array.from(new Set(hashes));
    const records = await Promise.all(uniqueHashes.map((hash) => getTokenRecord(hash)));

    return records
      .filter((record): record is TokenRecord => Boolean(record))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((record) => summarizeRecord(record, now));
  }

  return Array.from(store.tokens.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((record) => summarizeRecord(record, now));
}

export async function listSubmissions(): Promise<IntakeSubmission[]> {
  const redis = getRedisClient();

  if (redis) {
    const ids = await redis.lrange<string>(SUBMISSION_LIST_KEY, 0, SUBMISSION_LIST_LIMIT - 1);
    const uniqueIds = Array.from(new Set(ids));
    const submissions = await Promise.all(
      uniqueIds.map((id) => redis.get<IntakeSubmission>(submissionKey(id))),
    );

    return submissions.filter((submission): submission is IntakeSubmission => Boolean(submission));
  }

  return [...store.submissions];
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const credentials = getRedisCredentials();

  redisClient = credentials ? new Redis(credentials) : null;
  return redisClient;
}

function getRedisCredentials() {
  const candidates = [
    [process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN],
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
    [process.env.STORAGE_URL, process.env.STORAGE_TOKEN],
    [process.env.STORAGE_REST_URL, process.env.STORAGE_REST_TOKEN],
    [process.env.STORAGE_REST_API_URL, process.env.STORAGE_REST_API_TOKEN],
    [process.env.STORAGE_REDIS_REST_URL, process.env.STORAGE_REDIS_REST_TOKEN],
    [process.env.STORAGE_REDIS_REST_API_URL, process.env.STORAGE_REDIS_REST_API_TOKEN],
    [process.env.STORAGE_KV_REST_API_URL, process.env.STORAGE_KV_REST_API_TOKEN],
    [process.env.REDIS_REST_URL, process.env.REDIS_REST_TOKEN],
  ];

  const match = candidates.find(([url, token]) => Boolean(url && token));

  if (!match) {
    return null;
  }

  return {
    url: match[0] as string,
    token: match[1] as string,
  };
}

async function getTokenRecord(hash: string): Promise<TokenRecord | null> {
  const redis = getRedisClient();

  if (redis) {
    return redis.get<TokenRecord>(tokenKey(hash));
  }

  return store.tokens.get(hash) ?? null;
}

function summarizeRecord(record: TokenRecord, now: number): MagicLinkSummary {
  return {
    id: record.hash,
    hashPreview: `${record.hash.slice(0, 10)}...`,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
    status: getStatus(record, now),
  };
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

function tokenKey(hash: string): string {
  return `${KEY_PREFIX}:token:${hash}`;
}

function consumedKey(hash: string): string {
  return `${KEY_PREFIX}:consumed:${hash}`;
}

function submissionKey(id: string): string {
  return `${KEY_PREFIX}:submission:${id}`;
}