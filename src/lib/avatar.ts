// Avatar handling: validate → resize/compress with sharp → store.
//
// Storage: Vercel Blob in production (BLOB_READ_WRITE_TOKEN). Without a token
// (local development) files go to .data/avatars on disk instead. Blob URLs are
// never handed to the browser; /avatar/[id] proxies them so "login required"
// still holds and the initials fallback is automatic.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { del, put } from "@vercel/blob";
import { readEnv } from "./env";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const AVATAR_SIZE = 512; // stored as a 512×512 square
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const LOCAL_PREFIX = "local:";
const LOCAL_DIR = path.join(process.cwd(), ".data", "avatars");

export type ProcessedAvatar = { buffer: Buffer; contentType: "image/webp" };

/**
 * Check the upload and turn it into a compact 512px WebP square.
 * Throws an Error with a user-facing message when the file is not acceptable.
 * We look at the real bytes (sharp), not just the declared MIME type — an SVG
 * renamed to .png is rejected.
 */
export async function processAvatar(file: File): Promise<ProcessedAvatar> {
  if (file.size === 0) throw new Error("Choose a photo to upload.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("That photo is over 2MB. Please choose a smaller one.");
  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new Error("That file doesn't look like a valid image.");
  }
  if (!format || !["jpeg", "png", "webp", "gif"].includes(format)) {
    throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  }

  const buffer = await sharp(input, { animated: false })
    .rotate() // honour EXIF orientation from phones
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

/** True when uploads can be stored (Blob token present, or local dev fallback). */
export function avatarStorageAvailable(): boolean {
  return Boolean(readEnv("BLOB_READ_WRITE_TOKEN")) || process.env.NODE_ENV !== "production";
}

/**
 * Store the processed avatar and return the reference to save in User.avatarUrl.
 * Deletes the previous file when given.
 */
export async function storeAvatar(userId: string, avatar: ProcessedAvatar, previousRef: string | null): Promise<string> {
  const token = readEnv("BLOB_READ_WRITE_TOKEN");

  if (token) {
    const blob = await put(`avatars/${userId}.webp`, avatar.buffer, {
      access: "public", // URL is random and only ever fetched server-side by /avatar/[id]
      addRandomSuffix: true,
      contentType: avatar.contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      token,
    });
    if (previousRef && !previousRef.startsWith(LOCAL_PREFIX)) {
      await del(previousRef, { token }).catch(() => undefined);
    }
    return blob.url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Photo uploads are not configured (BLOB_READ_WRITE_TOKEN is missing).");
  }

  // Local development fallback: plain files on disk.
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const fileName = `${userId}-${Date.now()}.webp`;
  await fs.writeFile(path.join(LOCAL_DIR, fileName), avatar.buffer);
  if (previousRef?.startsWith(LOCAL_PREFIX)) {
    await fs.unlink(path.join(LOCAL_DIR, previousRef.slice(LOCAL_PREFIX.length))).catch(() => undefined);
  }
  return `${LOCAL_PREFIX}${fileName}`;
}

/** Remove a stored avatar (used when a member deletes their photo). */
export async function deleteAvatar(ref: string): Promise<void> {
  if (ref.startsWith(LOCAL_PREFIX)) {
    await fs.unlink(path.join(LOCAL_DIR, ref.slice(LOCAL_PREFIX.length))).catch(() => undefined);
    return;
  }
  const token = readEnv("BLOB_READ_WRITE_TOKEN");
  if (token) await del(ref, { token }).catch(() => undefined);
}

/** Fetch the stored bytes for /avatar/[id]. Returns null when missing. */
export async function readAvatar(ref: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (ref.startsWith(LOCAL_PREFIX)) {
    const safeName = path.basename(ref.slice(LOCAL_PREFIX.length));
    try {
      const file = await fs.readFile(path.join(LOCAL_DIR, safeName));
      const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      return { body, contentType: "image/webp" };
    } catch {
      return null;
    }
  }
  try {
    const response = await fetch(ref, { cache: "no-store" });
    if (!response.ok) return null;
    return {
      body: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "image/webp",
    };
  } catch {
    return null;
  }
}

/** Fallback avatar: initials on the studio green. */
export function initialsSvg(name: string): string {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const escaped = initials.replace(/[<>&"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="${escaped}">
  <rect width="128" height="128" fill="#14513B"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="56" font-weight="600" fill="#F4F1E8">${escaped}</text>
</svg>`;
}
