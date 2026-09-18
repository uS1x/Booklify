import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, storeUpload } from "@/lib/uploads";

export const runtime = "nodejs";

/** Eigene Bilder fürs Moodboard hochladen. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 });
  }
  if (!ALLOWED_MIME[file.type]) {
    return NextResponse.json({ error: "Nur JPEG, PNG, WebP, GIF oder AVIF." }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Maximal 6 MB pro Bild." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const stored = await storeUpload(user.id, file.type, bytes);
    const asset = await db.mediaAsset.create({
      data: {
        id: stored.id,
        userId: user.id,
        filename: file.name.slice(0, 200),
        mimeType: file.type,
        size: stored.size,
      },
    });
    return NextResponse.json({
      id: asset.id,
      url: `/api/media/${asset.id}`,
      filename: asset.filename,
      size: asset.size,
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    if (text === "TOO_LARGE") return NextResponse.json({ error: "Datei zu groß." }, { status: 413 });
    if (text === "UNSUPPORTED_TYPE") return NextResponse.json({ error: "Dateityp nicht erlaubt." }, { status: 415 });
    console.error("[uploads]", error);
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 500 });
  }
}
