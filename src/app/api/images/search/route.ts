import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { activeImageProvider, searchImages } from "@/lib/providers/images";

/** Bildsuche fürs Moodboard – ohne API-Key deaktiviert (Upload bleibt möglich). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (!query.trim()) {
    return NextResponse.json({ provider: activeImageProvider(), results: [] });
  }

  const { provider, results } = await searchImages(query);
  return NextResponse.json({ provider, results });
}
