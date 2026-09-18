import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { activeProvider, enrichCandidate, searchBooks, type BookSearchField } from "@/lib/providers/books";

/** Buchsuche über den konfigurierten Provider (Open Library, Google Books …). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const field = (url.searchParams.get("field") ?? "any") as BookSearchField;

  if (!query.trim()) {
    return NextResponse.json({ provider: activeProvider(), results: [] });
  }

  const { provider, results } = await searchBooks(query, field);

  // Die ersten Treffer um Beschreibungen anreichern.
  const enriched = await Promise.all(
    results.map((candidate, index) => (index < 6 ? enrichCandidate(candidate) : candidate)),
  );

  return NextResponse.json({ provider, results: enriched });
}
