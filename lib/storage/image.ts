import "server-only";

import sharp from "sharp";

export type CompressedImage = { buffer: Buffer; mimeType: string; extension: string };

// Resizes/re-encodes so uploads don't eat into R2's free-tier storage at full camera resolution.
// HEIC/HEIF is decode-only in prebuilt sharp binaries, so it's always re-encoded as JPEG/WebP —
// the stored mimeType/extension can differ from what was uploaded for those inputs.
export async function compressStyleDirectionImage(buffer: Buffer): Promise<CompressedImage> {
  let pipeline;
  let metadata;
  try {
    pipeline = sharp(buffer, { failOn: "none" }).rotate();
    metadata = await pipeline.metadata();
  } catch {
    throw new Error("Unsupported image format.");
  }

  const resized = pipeline.resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });

  if (metadata.hasAlpha) {
    return { buffer: await resized.webp({ quality: 82 }).toBuffer(), mimeType: "image/webp", extension: "webp" };
  }
  return { buffer: await resized.jpeg({ quality: 82 }).toBuffer(), mimeType: "image/jpeg", extension: "jpg" };
}
