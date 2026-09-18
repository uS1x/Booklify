"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

import { BookCover } from "@/components/ui/book-cover";
import { ProgressBar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ProgressDialog } from "@/components/books/progress-dialog";
import { formatNumber, formatRelative } from "@/lib/format";
import type { ShelfBook } from "@/server/queries/books";

/** „Lese ich gerade“ – mit direktem Zugriff auf den Lesefortschritt. */
export function CurrentlyReading({ books }: { books: ShelfBook[] }) {
  const [active, setActive] = useState<ShelfBook | null>(null);
  if (!books.length) return null;

  return (
    <section className="rounded-3xl border border-ink/8 bg-gradient-to-br from-surface to-paper-soft/60 p-5 shadow-soft sm:p-6 dark:border-white/8 dark:from-surface dark:to-surface-muted">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg text-ink">Gerade in Arbeit</h2>
        <Link href="/books?status=READING" className="text-xs text-ink-faint underline-offset-2 hover:underline">
          alle ansehen
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {books.slice(0, 3).map((book) => (
          <div key={book.id} className="flex gap-4">
            <Link href={`/books/${book.id}`} className="h-28 w-19 shrink-0 shadow-book transition-transform hover:-translate-y-0.5">
              <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} textScale={0.6} />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/books/${book.id}`} className="min-w-0">
                <h3 className="line-clamp-2 text-sm leading-snug font-medium text-ink">{book.title}</h3>
                <p className="truncate text-xs text-ink-faint">{book.author}</p>
              </Link>

              <div className="mt-auto pt-2">
                <ProgressBar value={book.progress} height="h-1.5" tone="bg-honey-400" />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-ink-faint tabular-nums">
                    {formatNumber(book.currentPage)}
                    {book.pageCount ? ` / ${formatNumber(book.pageCount)}` : ""} · {book.progress} %
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setActive(book)}>
                    <BookOpenCheck size={13} />
                    Seite
                  </Button>
                </div>
                {book.lastReadAt ? (
                  <p className="mt-1 text-[11px] text-ink-faint">gelesen {formatRelative(book.lastReadAt)}</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {active ? (
        <ProgressDialog
          open={Boolean(active)}
          onClose={() => setActive(null)}
          userBookId={active.id}
          title={active.title}
          pageCount={active.pageCount}
          currentPage={active.currentPage}
        />
      ) : null}
    </section>
  );
}
