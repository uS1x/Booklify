import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getShelfAccess } from "@/lib/permissions";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Hochgeladene Bilder ausliefern. Eigene Dateien immer, fremde nur, wenn das
 * Regal des Besitzers für den Betrachter freigegeben ist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  if (asset.userId !== user.id) {
    const access = await getShelfAccess(user.id, asset.userId);
    if (access === "NONE") return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const bytes = await readUpload(asset.userId, asset.id, asset.mimeType);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
