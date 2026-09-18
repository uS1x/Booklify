"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, HandHeart, Star } from "lucide-react";

import { BookCover } from "@/components/ui/book-cover";
import { hashToIndex } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ShelfBook } from "@/server/queries/books";

/** Deterministische „Unordnung“: gleiche Bücher stehen immer gleich im Regal. */
function shape(book: ShelfBook) {
  const h = hashToIndex(`${book.id}-h`, 7);
  const t = hashToIndex(`${book.id}-t`, 7);
  const w = hashToIndex(`${book.id}-w`, 5);
  const pageFactor = book.pageCount ? Math.min(1, Math.max(0, (book.pageCount - 120) / 900)) : 0.4;
  return {
    height: 168 + h * 9 + Math.round(pageFactor * 34),
    width: 78 + w * 7 + Math.round(pageFactor * 12),
    tilt: (t - 3) * 1.15,
  };
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function BookShelf({
  books,
  onSelect,
  shelfLabel,
}: {
  books: ShelfBook[];
  onSelect: (book: ShelfBook) => void;
  shelfLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(6);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const slot = width < 420 ? 92 : width < 768 ? 104 : 124;
      setPerRow(Math.max(2, Math.floor((width - 40) / slot)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => chunk(books, perRow), [books, perRow]);

  return (
    <div ref={ref} className="shelf-backdrop rounded-3xl px-1 pt-2 pb-1 sm:px-3">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="relative">
          <div className="flex min-h-[248px] items-end gap-2 overflow-visible px-3 pt-9 sm:min-h-[288px] sm:gap-3 sm:px-5">
            {row.map((book, i) => (
              <ShelfBookItem
                key={book.id}
                book={book}
                delay={rowIndex * 0.05 + i * 0.03}
                onSelect={onSelect}
              />
            ))}

            {/* Deko, wenn im letzten Regalboden Platz bleibt */}
            {rowIndex === rows.length - 1 && perRow - row.length >= 2 ? <ShelfDecor /> : null}
          </div>

          {/* Regalbrett */}
          <div className="relative">
            <div className="shelf-board h-3 rounded-[3px]" />
            <div className="shelf-front mx-[2px] h-[7px] rounded-b-md opacity-90" />
            <div className="pointer-events-none absolute inset-x-6 -top-3 h-3 bg-gradient-to-b from-ink/12 to-transparent blur-[2px]" />
          </div>

          {shelfLabel && rowIndex === 0 ? (
            <span className="absolute -top-1 right-4 rounded-full bg-surface/80 px-2.5 py-1 text-[11px] text-ink-faint shadow-soft backdrop-blur-sm">
              {shelfLabel}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ShelfBookItem({
  book,
  delay,
  onSelect,
}: {
  book: ShelfBook;
  delay: number;
  onSelect: (book: ShelfBook) => void;
}) {
  const { height, width, tilt } = shape(book);
  const isReading = book.status === "READING";
  const isLent = book.loanState === "LENT" || book.loanState === "RETURN_REQUESTED";

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(book)}
      initial={{ opacity: 0, y: 24, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ y: -16, rotate: 0, scale: 1.03 }}
      whileFocus={{ y: -16, rotate: 0 }}
      whileTap={{ scale: 0.98 }}
      transition={{ delay, type: "spring", stiffness: 340, damping: 26 }}
      style={{ height, width }}
      className="group relative shrink-0 origin-bottom focus:outline-none"
      aria-label={`${book.title} von ${book.author}`}
    >
      {/* Titel-Label beim Hover */}
      <span className="pointer-events-none absolute -top-7 left-1/2 z-20 w-max max-w-[190px] -translate-x-1/2 truncate rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {book.title}
      </span>

      <span className="absolute inset-0 shadow-book transition-shadow duration-300 group-hover:shadow-lift">
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          textScale={width / 110}
          className="ring-1 ring-black/5"
        />
      </span>

      {/* Lesezeichen für „lese ich gerade“ */}
      {isReading ? (
        <span className="absolute -top-2 right-1.5 flex flex-col items-center">
          <span className="h-5 w-2.5 rounded-t-sm bg-honey-400 shadow-sm" />
          <span className="h-0 w-2.5 border-x-[5px] border-t-[5px] border-x-transparent border-t-honey-400" />
        </span>
      ) : null}

      {book.favorite ? (
        <span className="absolute bottom-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-paper/85 text-honey-500 shadow-sm">
          <Star size={11} fill="currentColor" />
        </span>
      ) : null}

      {isLent ? (
        <span className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-clay-500/90 text-white shadow-sm" title="Verliehen">
          <HandHeart size={11} />
        </span>
      ) : null}

      {book.visibility === "FRIENDS" ? null : (
        <span
          className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-ink/55 text-paper shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
          title="Privat"
        >
          <Bookmark size={11} />
        </span>
      )}
    </motion.button>
  );
}

/** Kleine Deko für Lücken im Regal: liegender Stapel und eine Pflanze. */
function ShelfDecor() {
  return (
    <div className="ml-2 flex shrink-0 items-end gap-3 opacity-90">
      <div className="flex flex-col items-center">
        <div className="h-2.5 w-16 rounded-sm bg-sage-300 shadow-sm" />
        <div className="h-2.5 w-20 rounded-sm bg-clay-200 shadow-sm" />
        <div className="h-3 w-18 rounded-sm bg-honey-200 shadow-sm" />
      </div>
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5">
          <span className="h-6 w-2 rotate-[-18deg] rounded-full bg-sage-400" />
          <span className="h-9 w-2 rounded-full bg-sage-400" />
          <span className="h-5 w-2 rotate-[20deg] rounded-full bg-sage-300" />
        </div>
        <div
          className={cn(
            "h-7 w-9 rounded-b-xl rounded-t-sm bg-gradient-to-b from-clay-300 to-clay-500 shadow-sm",
          )}
        />
      </div>
    </div>
  );
}
