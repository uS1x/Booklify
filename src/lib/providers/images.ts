import "server-only";

/**
 * Bildsuche fürs Moodboard. Ohne konfigurierten Key bleibt die Suche
 * deaktiviert – Upload, Farbflächen, Notizen und Zeichnungen funktionieren
 * unabhängig davon.
 *
 *  IMAGE_PROVIDER=unsplash → UNSPLASH_ACCESS_KEY
 *  IMAGE_PROVIDER=pexels   → PEXELS_API_KEY
 *  IMAGE_PROVIDER=none     → deaktiviert (Standard)
 */
export type StockImage = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  color?: string | null;
  description?: string | null;
  authorName?: string | null;
  authorUrl?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
};

export type ImageProviderInfo = {
  id: "unsplash" | "pexels" | "none";
  label: string;
  configured: boolean;
  hint: string;
};

export function activeImageProvider(): ImageProviderInfo {
  const id = (process.env.IMAGE_PROVIDER ?? "none").toLowerCase();
  if (id === "unsplash") {
    return {
      id: "unsplash",
      label: "Unsplash",
      configured: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      hint: "UNSPLASH_ACCESS_KEY in .env setzen",
    };
  }
  if (id === "pexels") {
    return {
      id: "pexels",
      label: "Pexels",
      configured: Boolean(process.env.PEXELS_API_KEY),
      hint: "PEXELS_API_KEY in .env setzen",
    };
  }
  return { id: "none", label: "Keine Bildsuche", configured: false, hint: "IMAGE_PROVIDER in .env setzen" };
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchImages(
  query: string,
): Promise<{ provider: ImageProviderInfo; results: StockImage[] }> {
  const provider = activeImageProvider();
  const q = query.trim();
  if (!provider.configured || q.length < 2) return { provider, results: [] };

  if (provider.id === "unsplash") {
    const data = await fetchJson<{
      results?: {
        id: string;
        width: number;
        height: number;
        color?: string;
        alt_description?: string;
        urls: { small: string; regular: string };
        links: { html: string };
        user: { name: string; links: { html: string } };
      }[];
    }>(
      `https://api.unsplash.com/search/photos?per_page=24&content_filter=high&query=${encodeURIComponent(q)}`,
      { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
    );

    return {
      provider,
      results: (data?.results ?? []).map((p) => ({
        id: p.id,
        thumbUrl: p.urls.small,
        fullUrl: p.urls.regular,
        width: p.width,
        height: p.height,
        color: p.color ?? null,
        description: p.alt_description ?? null,
        authorName: p.user?.name ?? null,
        authorUrl: p.user?.links?.html ?? null,
        sourceName: "Unsplash",
        sourceUrl: p.links?.html ?? null,
      })),
    };
  }

  if (provider.id === "pexels") {
    const data = await fetchJson<{
      photos?: {
        id: number;
        width: number;
        height: number;
        avg_color?: string;
        alt?: string;
        url: string;
        photographer: string;
        photographer_url: string;
        src: { medium: string; large: string };
      }[];
    }>(`https://api.pexels.com/v1/search?per_page=24&query=${encodeURIComponent(q)}`, {
      Authorization: process.env.PEXELS_API_KEY ?? "",
    });

    return {
      provider,
      results: (data?.photos ?? []).map((p) => ({
        id: String(p.id),
        thumbUrl: p.src.medium,
        fullUrl: p.src.large,
        width: p.width,
        height: p.height,
        color: p.avg_color ?? null,
        description: p.alt ?? null,
        authorName: p.photographer ?? null,
        authorUrl: p.photographer_url ?? null,
        sourceName: "Pexels",
        sourceUrl: p.url ?? null,
      })),
    };
  }

  return { provider, results: [] };
}
