"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { HandHeart, Lock, Palette, Star, Tag as TagIcon } from "lucide-react";

import { BookCover } from "@/components/ui/book-cover";
import { Stars } from "@/components/ui/rating";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/books/status-badge";
import { READING_STATUS_META, LOAN_STATE_META } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ShelfBook } from "@/server/queries/books";

export function BookGrid({ books, owner }: { books: ShelfBook[]; owner: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book, i) => (
        <motion.div
          key={book.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.35 }}
        >
          <Link href={`/books/${book.id}`} className="group block">
            <div className="relative aspect-2/3 transition-transform duration-300 group-hover:-translate-y-1.5">
              <div className="size-full shadow-book transition-shadow duration-300 group-hover:shadow-lift">
                <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} textScale={1.05} />
              </div>

              {book.status === "READING" ? (
                <div className="absolute inset-x-2 bottom-2 rounded-full bg-ink/60 p-1 backdrop-blur-sm">
                  <ProgressBar value={book.progress} height="h-1" tone="bg-honey-300" className="bg-white/25" />
                </div>
              ) : null}

              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {book.favorite ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-paper/90 text-honey-500 shadow-sm">
                    <Star size={12} fill="currentColor" />
                  </span>
                ) : null}
                {owner && book.visibility === "PRIVATE" ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-ink/55 text-paper shadow-sm" title="Privat">
                    <Lock size={11} />
                  </span>
                ) : null}
                {book.loanState === "LENT" || book.loanState === "RETURN_REQUESTED" ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-clay-500/90 text-white shadow-sm" title="Verliehen">
                    <HandHeart size={12} />
                  </span>
                ) : null}
                {book.hasMoodboard ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-plum-300/90 text-white shadow-sm" title="Moodboard vorhanden">
                    <Palette size={12} />
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <h3 className="line-clamp-2 text-sm leading-snug font-medium text-ink group-hover:text-clay-600 dark:group-hover:text-clay-300">
                {book.title}
              </h3>
              <p className="mt-0.5 truncate text-xs text-ink-faint">{book.author}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", READING_STATUS_META[book.status].dot)} />
                <span className="truncate text-[11px] text-ink-faint">
                  {book.status === "READING"
                    ? `${book.progress} % gelesen`
                    : READING_STATUS_META[book.status].short}
                </span>
                {book.rating ? <Stars value={book.rating} size={11} className="ml-auto" /> : null}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export function BookList({ books, owner }: { books: ShelfBook[]; owner: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-surface dark:border-white/8">
      {books.map((book, i) => (
        <Link
          key={book.id}
          href={`/books/${book.id}`}
          className={cn(
            "group flex items-center gap-4 px-3 py-3 transition-colors hover:bg-paper-soft/70 sm:px-5 dark:hover:bg-white/5",
            i > 0 && "border-t border-ink/6 dark:border-white/6",
          )}
        >
          <div className="h-20 w-14 shrink-0 shadow-soft">
            <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} textScale={0.5} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-ink group-hover:text-clay-600 dark:group-hover:text-clay-300">
              {book.title}
            </h3>
            <p className="truncate text-sm text-ink-faint">{book.author}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              {book.genres.slice(0, 2).map((g) => (
                <span key={g.slug}>
                  {g.emoji} {g.name}
                </span>
              ))}
              {book.pageCount ? <span>{formatNumber(book.pageCount)} S.</span> : null}
              {book.publishedYear ? <span>{book.publishedYear}</span> : null}
              {book.tags.length ? (
                <span className="inline-flex items-center gap-1">
                  <TagIcon size={11} />
                  {book.tags.slice(0, 3).join(", ")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="hidden w-44 shrink-0 sm:block">
            {book.status === "READING" ? (
              <>
                <ProgressBar value={book.progress} height="h-1.5" />
                <p className="mt-1 text-right text-[11px] text-ink-faint tabular-nums">
                  {formatNumber(book.currentPage)}
                  {book.pageCount ? ` / ${formatNumber(book.pageCount)}` : ""} · {book.progress} %
                </p>
              </>
            ) : book.status === "READ" ? (
              <p className="text-right text-[11px] text-ink-faint">
                {book.finishedAt ? `gelesen am ${formatDate(book.finishedAt)}` : "gelesen"}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={book.status} short withEmoji={false} />
            {book.rating ? <Stars value={book.rating} size={12} /> : null}
            {owner && book.loanState !== "AVAILABLE" ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px]", LOAN_STATE_META[book.loanState].tone)}>
                {LOAN_STATE_META[book.loanState].label}
              </span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
