"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, Library, List } from "lucide-react";

import { BookShelf } from "@/components/books/book-shelf";
import { BookGrid, BookList } from "@/components/books/book-grid";
import { BookQuickLook, type FriendBookContext } from "@/components/books/book-quick-look";
import { Segmented } from "@/components/ui/segmented";
import { VIEW_MODES, type ViewMode } from "@/lib/constants";
import type { ShelfBook } from "@/server/queries/books";

const STORAGE_KEY = "regal-view";

/**
 * Bündelt Regal-, Grid- und Listenansicht inklusive Ansichtswechsel und
 * „Buch aufschlagen“. Die gewählte Ansicht wird pro Gerät gespeichert.
 */
export function LibraryView({
  books,
  owner,
  header,
  shelfLabel,
  friendContexts,
  defaultView = "shelf",
  emptyState,
  storageKey = STORAGE_KEY,
}: {
  books: ShelfBook[];
  owner: boolean;
  header?: ReactNode;
  shelfLabel?: string;
  friendContexts?: Record<string, FriendBookContext>;
  defaultView?: ViewMode;
  emptyState?: ReactNode;
  storageKey?: string;
}) {
  const [view, setView] = useState<ViewMode>(defaultView);
  const [selected, setSelected] = useState<ShelfBook | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ViewMode | null;
    if (stored && VIEW_MODES.includes(stored)) {
      setView(stored);
    } else if (window.matchMedia("(max-width: 640px)").matches) {
      // Auf dem Smartphone ist das Regal zu eng – Grid ist die bessere Startansicht.
      setView("grid");
    }
  }, [storageKey]);

  const change = (next: ViewMode) => {
    setView(next);
    localStorage.setItem(storageKey, next);
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">{header}</div>
        <Segmented
          id={storageKey}
          value={view}
          onChange={change}
          size="sm"
          options={[
            { value: "shelf", label: <span className="hidden sm:inline">Regal</span>, icon: <Library size={15} />, title: "Regalansicht" },
            { value: "grid", label: <span className="hidden sm:inline">Grid</span>, icon: <LayoutGrid size={15} />, title: "Grid" },
            { value: "list", label: <span className="hidden sm:inline">Liste</span>, icon: <List size={15} />, title: "Liste" },
          ]}
        />
      </div>

      {books.length === 0 ? (
        emptyState
      ) : view === "shelf" ? (
        <BookShelf books={books} onSelect={setSelected} shelfLabel={shelfLabel} />
      ) : view === "grid" ? (
        <BookGrid books={books} owner={owner} />
      ) : (
        <BookList books={books} owner={owner} />
      )}

      <BookQuickLook
        book={selected}
        onClose={() => setSelected(null)}
        owner={owner}
        friendContext={selected ? friendContexts?.[selected.id] : undefined}
      />
    </section>
  );
}
