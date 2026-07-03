import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { config, publicPhotosDir } from "../config.js";
import { HttpError } from "../middleware/errorHandler.js";

/**
 * Profile-photo storage.
 *
 * Production: Cloudflare R2 (S3-compatible) — nothing is written to the VPS.
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET
 *   R2_PUBLIC_BASE_URL — the bucket's public URL (r2.dev subdomain or custom
 *   domain), used to build the public photo URLs.
 *
 * Dev fallback: when R2 is not configured, photos are written to the local
 * uploads directory so the app still works without credentials.
 *
 * photo_path column convention:
 *   "r2:photos/<uuid>.webp"  -> served from R2_PUBLIC_BASE_URL
 *   "<uuid>.webp"            -> served from /api/uploads/photos (dev fallback)
 */

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
};

let r2: S3Client | null | undefined;

function getR2(): S3Client | null {
  if (r2 !== undefined) return r2;
  if (
    !config.R2_ACCOUNT_ID ||
    !config.R2_ACCESS_KEY_ID ||
    !config.R2_SECRET_ACCESS_KEY ||
    !config.R2_BUCKET
  ) {
    r2 = null;
    return null;
  }
  r2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
  return r2;
}

export function isR2Configured(): boolean {
  return getR2() !== null;
}

/** Upload a profile photo; returns the value to store in photo_path. */
export async function storeProfilePhoto(
  file: Express.Multer.File
): Promise<string> {
  const ext = ALLOWED_PHOTO_TYPES[file.mimetype];
  if (!ext || file.mimetype === "image/svg+xml") {
    throw new HttpError(400, "Photo must be webp, jpeg or png");
  }
  const name = `${crypto.randomUUID()}${ext}`;

  const client = getR2();
  if (client) {
    const key = `photos/${name}`;
    await client.send(
      new PutObjectCommand({
        Bucket: config.R2_BUCKET!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=604800",
      })
    );
    return `r2:${key}`;
  }

  // Dev fallback only — production should always have R2 configured
  fs.mkdirSync(publicPhotosDir, { recursive: true });
  fs.writeFileSync(path.join(publicPhotosDir, name), file.buffer);
  return name;
}

/** Resolve a stored photo_path to a browser-usable URL. */
export function photoUrlFor(photoPath: string | null): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("r2:")) {
    const base = (config.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    return base ? `${base}/${photoPath.slice(3)}` : null;
  }
  return `/api/uploads/photos/${photoPath}`;
}

export async function deleteProfilePhoto(photoPath: string): Promise<void> {
  try {
    if (photoPath.startsWith("r2:")) {
      const client = getR2();
      if (client) {
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.R2_BUCKET!,
            Key: photoPath.slice(3),
          })
        );
      }
    } else {
      const p = path.join(publicPhotosDir, path.basename(photoPath));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch (err) {
    console.error("Photo deletion failed:", err);
  }
}
