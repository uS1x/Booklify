import "server-only";

import { mapSubjectsToGenres } from "./genre-map";

/**
 * Abstraktion für Buch-Metadaten-Provider.
 *
 *  BOOK_PROVIDER=openlibrary  → funktioniert ohne API-Key (Standard)
 *  BOOK_PROVIDER=googlebooks  → nutzt GOOGLE_BOOKS_API_KEY, falls gesetzt
 *  BOOK_PROVIDER=none         → Suche deaktiviert, manuelle Eingabe bleibt möglich
 */
export type BookSearchField = "any" | "title" | "author" | "isbn";

export type BookCandidate = {
  source: string;
  externalId: string;
  title: string;
  subtitle?: string | null;
  author: string;
  coverUrl?: string | null;
  description?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publishedYear?: number | null;
  publishedDate?: string | null;
  publisher?: string | null;
  pageCount?: number | null;
  language?: string | null;
  genreSlugs: string[];
  subjects: string[];
};

export type ProviderInfo = { id: string; label: string; configured: boolean; needsKey: boolean };

const TIMEOUT_MS = 9000;

export function activeProvider(): ProviderInfo {
  const id = (process.env.BOOK_PROVIDER ?? "openlibrary").toLowerCase();
  switch (id) {
    case "googlebooks":
      return { id, label: "Google Books", configured: true, needsKey: false };
    case "none":
      return { id, label: "Keine API", configured: false, needsKey: false };
    case "openlibrary":
    default:
      return { id: "openlibrary", label: "Open Library", configured: true, needsKey: false };
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "DigitalesBuecherregal/1.0", ...(init?.headers ?? {}) },
      next: { revalidate: 60 * 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ────────────────────────────────────────────────────────── Open Library */

type OLDoc = {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  language?: string[];
  publisher?: string[];
  subject?: string[];
  first_sentence?: string[];
};

const OL_LANG: Record<string, string> = {
  ger: "de", deu: "de", eng: "en", fre: "fr", fra: "fr", spa: "es",
  ita: "it", dut: "nl", nld: "nl", swe: "sv", jpn: "ja",
};

function olToCandidate(doc: OLDoc): BookCandidate {
  const isbns = doc.isbn ?? [];
  const subjects = doc.subject?.slice(0, 25) ?? [];
  return {
    source: "openlibrary",
    externalId: doc.key?.replace("/works/", "") ?? "",
    title: doc.title ?? "Ohne Titel",
    subtitle: doc.subtitle ?? null,
    author: doc.author_name?.slice(0, 2).join(", ") ?? "Unbekannt",
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    description: doc.first_sentence?.[0] ?? null,
    isbn10: isbns.find((i) => i.length === 10) ?? null,
    isbn13: isbns.find((i) => i.length === 13) ?? null,
    publishedYear: doc.first_publish_year ?? null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    publisher: doc.publisher?.[0] ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    language: OL_LANG[doc.language?.[0] ?? ""] ?? doc.language?.[0] ?? null,
    genreSlugs: mapSubjectsToGenres(subjects),
    subjects,
  };
}

async function searchOpenLibrary(query: string, field: BookSearchField): Promise<BookCandidate[]> {
  const fields =
    "key,title,subtitle,author_name,first_publish_year,isbn,number_of_pages_median,cover_i,language,publisher,subject,first_sentence";
  const params = new URLSearchParams({ fields, limit: "20", lang: "de" });

  if (field === "title") params.set("title", query);
  else if (field === "author") params.set("author", query);
  else if (field === "isbn") params.set("isbn", query.replace(/[^0-9Xx]/g, ""));
  else params.set("q", query);

  const data = await fetchJson<{ docs?: OLDoc[] }>(`https://openlibrary.org/search.json?${params}`);
  return (data?.docs ?? []).filter((d) => d.title).map(olToCandidate);
}

async function detailsOpenLibrary(workId: string): Promise<Partial<BookCandidate> | null> {
  const data = await fetchJson<{
    description?: string | { value?: string };
    subjects?: string[];
  }>(`https://openlibrary.org/works/${workId}.json`);
  if (!data) return null;
  const description =
    typeof data.description === "string" ? data.description : data.description?.value ?? null;
  return {
    description: description?.replace(/\r/g, "").split("----------")[0].trim() ?? null,
    subjects: data.subjects?.slice(0, 25) ?? [],
    genreSlugs: mapSubjectsToGenres(data.subjects ?? []),
  };
}

/* ────────────────────────────────────────────────────────── Google Books */

type GBItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
};

function gbToCandidate(item: GBItem): BookCandidate {
  const v = item.volumeInfo ?? {};
  const ids = v.industryIdentifiers ?? [];
  const year = v.publishedDate ? Number.parseInt(v.publishedDate.slice(0, 4), 10) : null;
  const subjects = v.categories ?? [];
  return {
    source: "googlebooks",
    externalId: item.id,
    title: v.title ?? "Ohne Titel",
    subtitle: v.subtitle ?? null,
    author: v.authors?.slice(0, 2).join(", ") ?? "Unbekannt",
    coverUrl: (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail)?.replace("http://", "https://") ?? null,
    description: v.description ?? null,
    isbn10: ids.find((i) => i.type === "ISBN_10")?.identifier ?? null,
    isbn13: ids.find((i) => i.type === "ISBN_13")?.identifier ?? null,
    publishedYear: Number.isFinite(year) ? year : null,
    publishedDate: v.publishedDate ?? null,
    publisher: v.publisher ?? null,
    pageCount: v.pageCount ?? null,
    language: v.language ?? null,
    genreSlugs: mapSubjectsToGenres(subjects),
    subjects,
  };
}

async function searchGoogleBooks(query: string, field: BookSearchField): Promise<BookCandidate[]> {
  const q =
    field === "title" ? `intitle:${query}`
    : field === "author" ? `inauthor:${query}`
    : field === "isbn" ? `isbn:${query.replace(/[^0-9Xx]/g, "")}`
    : query;

  const params = new URLSearchParams({ q, maxResults: "20", printType: "books" });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set("key", key);

  const data = await fetchJson<{ items?: GBItem[] }>(`https://www.googleapis.com/books/v1/volumes?${params}`);
  return (data?.items ?? []).map(gbToCandidate);
}

/* ────────────────────────────────────────────────────────── Öffentliche API */

export async function searchBooks(
  query: string,
  field: BookSearchField = "any",
): Promise<{ provider: ProviderInfo; results: BookCandidate[] }> {
  const provider = activeProvider();
  const trimmed = query.trim();
  if (!provider.configured || trimmed.length < 2) return { provider, results: [] };

  const results =
    provider.id === "googlebooks"
      ? await searchGoogleBooks(trimmed, field)
      : await searchOpenLibrary(trimmed, field);

  // Duplikate (gleicher Titel + Autor) zusammenfassen, Treffer mit Cover zuerst.
  const seen = new Set<string>();
  return {
    provider,
    results: results
      .filter((r) => {
        const key = `${r.title.toLowerCase()}|${r.author.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)))
      .slice(0, 18),
  };
}

/** Nachladen der Beschreibung – Suchtreffer enthalten sie oft nicht. */
export async function enrichCandidate(candidate: BookCandidate): Promise<BookCandidate> {
  if (candidate.description && candidate.description.length > 120) return candidate;
  if (candidate.source !== "openlibrary" || !candidate.externalId) return candidate;
  const extra = await detailsOpenLibrary(candidate.externalId);
  if (!extra) return candidate;
  return {
    ...candidate,
    description: extra.description || candidate.description,
    subjects: extra.subjects?.length ? extra.subjects : candidate.subjects,
    genreSlugs: extra.genreSlugs?.length ? extra.genreSlugs : candidate.genreSlugs,
  };
}
