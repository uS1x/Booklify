import "server-only";

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/** Uploads liegen außerhalb von /public und werden nur über /api/media ausgeliefert. */
const ROOT = resolve(process.cwd(), "data", "uploads");

export const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

function assetPath(userId: string, id: string, ext: string) {
  // userId und id stammen aus der Datenbank bzw. randomUUID – keine Pfadanteile.
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeExt = ext.replace(/[^a-z0-9]/g, "");
  return join(ROOT, safeUser, `${safeId}.${safeExt}`);
}

export async function storeUpload(userId: string, mimeType: string, bytes: Buffer) {
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) throw new Error("UNSUPPORTED_TYPE");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("TOO_LARGE");

  const id = randomUUID();
  const path = assetPath(userId, id, ext);
  await mkdir(join(ROOT, userId.replace(/[^a-zA-Z0-9_-]/g, "")), { recursive: true });
  await writeFile(path, bytes);
  return { id, ext, path, size: bytes.byteLength };
}

export async function readUpload(userId: string, assetId: string, mimeType: string) {
  const ext = ALLOWED_MIME[mimeType] ?? "bin";
  return readFile(assetPath(userId, assetId, ext));
}

export async function removeUpload(userId: string, assetId: string, mimeType: string) {
  const ext = ALLOWED_MIME[mimeType] ?? "bin";
  await unlink(assetPath(userId, assetId, ext)).catch(() => {});
}
