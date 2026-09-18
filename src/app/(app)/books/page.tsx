import type { Metadata } from "next";
import { BookPlus, SearchX } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getLibraryFacets, getUserBooks, type LibraryFilters } from "@/server/queries/books";
import { LibraryView } from "@/components/books/library-view";
import { FilterBar } from "@/components/books/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import type { SortOption } from "@/lib/constants";

export const metadata: Metadata = { title: "Meine Bücher" };

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters: LibraryFilters = {
    q: single("q"),
    status: single("status"),
    genre: single("genre"),
    tag: single("tag"),
    year: single("year"),
    minRating: single("minRating"),
    sort: (single("sort") as SortOption) ?? "recent",
  };

  const [books, facets] = await Promise.all([
    getUserBooks(user.id, filters),
    getLibraryFacets(user.id),
  ]);

  const filtered = Object.entries(filters).some(([key, value]) => value && key !== "sort");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">Meine Bücher</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Deine vollständige Bibliothek – filtern, sortieren, wiederfinden.
          </p>
        </div>
        <div className="hidden sm:block">
          <ButtonLink href="/books/new">
            <BookPlus size={16} />
            Buch hinzufügen
          </ButtonLink>
        </div>
      </header>

      <FilterBar facets={facets} total={books.length} />

      <LibraryView
        books={books}
        owner
        defaultView="grid"
        storageKey="regal-view-library"
        header={null}
        emptyState={
          filtered ? (
            <EmptyState
              icon={<SearchX size={22} />}
              title="Keine Treffer"
              description="Für diese Kombination aus Suche und Filtern steht nichts im Regal."
            />
          ) : (
            <EmptyState
              icon={<BookPlus size={22} />}
              title="Noch keine Bücher"
              description="Füge dein erstes Buch hinzu – per Suche oder manuell."
              action={
                <ButtonLink href="/books/new">
                  <BookPlus size={16} />
                  Buch hinzufügen
                </ButtonLink>
              }
            />
          )
        }
      />
    </div>
  );
}
