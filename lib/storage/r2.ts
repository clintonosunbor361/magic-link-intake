import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export async function putPrivateObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key, Body: body, ContentType: contentType }),
  );
}

// Vendor Brief export embeds image bytes directly into the PDF rather than linking to them: the
// brief is sent outside the app over WhatsApp, where a signed URL would both expire long before the
// brief stops being useful and hand a vendor a way into private storage.
export async function getPrivateObjectBytes(key: string): Promise<Buffer> {
  const response = await getR2Client().send(
    new GetObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key }),
  );
  const body = response.Body;
  if (!body) throw new Error("The stored file could not be read.");
  return Buffer.from(await body.transformToByteArray());
}

export async function deletePrivateObject(key: string): Promise<void> {
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key }));
  } catch {
    // Best-effort cleanup only — a failed delete here must never mask the error that triggered it
    // (e.g. a database write failing after a successful R2 upload).
  }
}

// A local HMAC computation against the S3 signing algorithm, no network round-trip — cheap enough
// to call fresh on every page render/request rather than caching a URL past its usefulness.
export async function getSignedPrivateViewUrl(
  key: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}
