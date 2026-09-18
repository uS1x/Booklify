"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { READING_STATUSES, READING_STATUS_META, SORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/cn";

export type Facets = {
  genres: { slug: string; name: string; emoji: string | null }[];
  tags: string[];
  years: number[];
  statusCounts: Record<string, number>;
};

/** Suche, Filter und Sortierung – vollständig über die URL steuerbar. */
export function FilterBar({ facets, total }: { facets: Facets; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);

  const current = {
    status: params.get("status") ?? "all",
    genre: params.get("genre") ?? "",
    tag: params.get("tag") ?? "",
    year: params.get("year") ?? "",
    minRating: params.get("minRating") ?? "",
    sort: params.get("sort") ?? "recent",
  };

  const activeCount = [current.genre, current.tag, current.year, current.minRating].filter(Boolean).length +
    (current.status !== "all" ? 1 : 0);

  const push = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Suchfeld entprellt in die URL übertragen.
  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (query === currentQ) return;
    const timer = setTimeout(() => push({ q: query || null }), 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (params.get("focus")) {
      document.getElementById("library-search")?.focus();
    }
  }, [params]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            id="library-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel, Autor, Genre, Tag oder Notiz …"
            aria-label="Bibliothek durchsuchen"
            className="h-11 w-full rounded-full border border-ink/10 bg-surface pr-10 pl-10 text-sm text-ink placeholder:text-ink-faint/80 focus:border-clay-300 focus:outline-none focus:ring-4 focus:ring-clay-200/40 dark:border-white/10 dark:bg-white/5"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche löschen"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint hover:text-ink"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <Button
          variant={showFilters || activeCount ? "soft" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          className="shrink-0"
        >
          <SlidersHorizontal size={16} />
          Filter
          {activeCount ? (
            <span className="ml-1 rounded-full bg-clay-500 px-1.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>

        <div className="w-full shrink-0 sm:w-56">
          <Select
            value={current.sort}
            onChange={(e) => push({ sort: e.target.value })}
            aria-label="Sortierung"
            className="h-11 rounded-full"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Statusreiter */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        <StatusChip label="Alle" count={total} active={current.status === "all"} onClick={() => push({ status: null })} />
        {READING_STATUSES.map((status) => (
          <StatusChip
            key={status}
            label={`${READING_STATUS_META[status].emoji} ${READING_STATUS_META[status].label}`}
            count={facets.statusCounts[status] ?? 0}
            active={current.status === status}
            onClick={() => push({ status })}
          />
        ))}
      </div>

      {showFilters ? (
        <div className="grid gap-3 rounded-2xl border border-ink/8 bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/8">
          <label className="text-xs text-ink-faint">
            Genre
            <Select value={current.genre} onChange={(e) => push({ genre: e.target.value })} className="mt-1">
              <option value="">Alle Genres</option>
              {facets.genres.map((genre) => (
                <option key={genre.slug} value={genre.slug}>
                  {genre.emoji} {genre.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-xs text-ink-faint">
            Tag
            <Select value={current.tag} onChange={(e) => push({ tag: e.target.value })} className="mt-1">
              <option value="">Alle Tags</option>
              {facets.tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-xs text-ink-faint">
            Erscheinungsjahr
            <Select value={current.year} onChange={(e) => push({ year: e.target.value })} className="mt-1">
              <option value="">Alle Jahre</option>
              {facets.years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-xs text-ink-faint">
            Bewertung
            <Select value={current.minRating} onChange={(e) => push({ minRating: e.target.value })} className="mt-1">
              <option value="">Beliebig</option>
              {[9, 8, 7, 6, 5].map((value) => (
                <option key={value} value={String(value)}>
                  ab {value} / 10
                </option>
              ))}
            </Select>
          </label>

          {activeCount ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => push({ genre: null, tag: null, year: null, minRating: null, status: null })}
              >
                <X size={14} />
                Filter zurücksetzen
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={cn("text-xs text-ink-faint transition-opacity", pending && "opacity-50")}>
        {total === 1 ? "1 Buch" : `${total} Bücher`}
        {current.genre ? ` · Genre: ${facets.genres.find((g) => g.slug === current.genre)?.name}` : ""}
        {current.tag ? ` · Tag: ${current.tag}` : ""}
      </div>
    </div>
  );
}

function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-transparent bg-ink text-paper dark:bg-clay-400 dark:text-ink"
          : "border-ink/10 text-ink-soft hover:border-ink/25 hover:text-ink dark:border-white/12",
      )}
    >
      {label}
      <Badge
        className={cn(
          "px-1.5 py-0 text-[10px]",
          active ? "bg-white/20 text-paper dark:bg-ink/15 dark:text-ink" : "bg-ink/6 text-ink-faint dark:bg-white/10",
        )}
      >
        {count}
      </Badge>
    </button>
  );
}
