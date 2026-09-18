"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, CheckCircle2, Palette, Sparkles } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/rating";
import { ReadingProgressLine } from "@/components/ui/progress";
import { StatusSelect } from "@/components/books/status-select";
import { StatusBadge } from "@/components/books/status-badge";
import { ProgressDialog } from "@/components/books/progress-dialog";
import { LoanRequestButton } from "@/components/loans/loan-request-button";
import { BookCover } from "@/components/ui/book-cover";
import { LOAN_STATE_META } from "@/lib/constants";
import { formatDate, truncate } from "@/lib/format";
import type { ShelfBook } from "@/server/queries/books";

export type FriendBookContext = {
  canRequest: boolean;
  alreadyOwned: boolean;
  pendingRequest: boolean;
};

/**
 * „Buch aufschlagen“: das Cover klappt beim Öffnen auf, daneben stehen die
 * wichtigsten Angaben und Aktionen.
 */
export function BookQuickLook({
  book,
  onClose,
  owner,
  friendContext,
}: {
  book: ShelfBook | null;
  onClose: () => void;
  owner: boolean;
  friendContext?: FriendBookContext;
}) {
  const [progressOpen, setProgressOpen] = useState(false);
  if (!book) return null;

  return (
    <>
      <Modal open={Boolean(book)} onClose={onClose} size="lg" hideClose>
        <div className="flex flex-col gap-6 pt-3 pb-2 sm:flex-row sm:gap-8 sm:pt-5">
          <motion.div
            initial={{ rotateY: -78, opacity: 0.2 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "left center", perspective: 1400 }}
            className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48"
          >
            <div className="aspect-2/3 shadow-book">
              <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} textScale={1.4} priority />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="min-w-0 flex-1"
          >
            <div className="flex flex-wrap items-center gap-2">
              {book.genres.slice(0, 3).map((g) => (
                <Badge key={g.slug} className="bg-paper-deep/70 dark:bg-white/10">
                  {g.emoji} {g.name}
                </Badge>
              ))}
              {!owner ? (
                <Badge className="bg-paper-deep/70 dark:bg-white/10">📚 Im Besitz von {book.owner.displayName}</Badge>
              ) : null}
            </div>

            <h2 className="mt-3 text-2xl leading-tight text-ink">{book.title}</h2>
            <p className="mt-1 text-ink-soft">{book.author}</p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {owner ? (
                <StatusSelect userBookId={book.id} status={book.status} size="sm" />
              ) : (
                <StatusBadge status={book.status} />
              )}
              <Stars value={book.rating} showValue={Boolean(book.rating)} />
            </div>

            {book.status === "READING" ? (
              <ReadingProgressLine
                currentPage={book.currentPage}
                pageCount={book.pageCount}
                className="mt-5"
                compact
              />
            ) : null}

            {book.description ? (
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{truncate(book.description, 260)}</p>
            ) : null}

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {book.pageCount ? (
                <Meta label="Seiten" value={`${book.pageCount}`} />
              ) : null}
              {book.publishedYear ? <Meta label="Erschienen" value={`${book.publishedYear}`} /> : null}
              {owner ? <Meta label="Hinzugefügt" value={formatDate(book.addedAt)} /> : null}
              {book.loanState !== "AVAILABLE" ? (
                <Meta label="Ausleihe" value={LOAN_STATE_META[book.loanState].label} />
              ) : null}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink href={`/books/${book.id}`} size="md">
                Buchseite öffnen
                <ArrowRight size={16} />
              </ButtonLink>

              {owner ? (
                <>
                  {book.status === "READING" ? (
                    <Button variant="soft" onClick={() => setProgressOpen(true)}>
                      <BookOpenCheck size={16} />
                      Fortschritt
                    </Button>
                  ) : null}
                  <ButtonLink href={`/books/${book.id}/moodboard`} variant="soft">
                    <Palette size={16} />
                    Moodboard
                  </ButtonLink>
                  {book.status === "READ" && book.answerCount === 0 ? (
                    <ButtonLink href={`/books/${book.id}/questionnaire`} variant="soft">
                      <Sparkles size={16} />
                      Fragebogen
                    </ButtonLink>
                  ) : null}
                </>
              ) : friendContext?.alreadyOwned ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-2.5 text-sm text-sage-500 dark:bg-sage-500/15 dark:text-sage-200">
                  <CheckCircle2 size={16} />
                  Du besitzt dieses Buch bereits.
                </span>
              ) : friendContext?.pendingRequest ? (
                <Badge tone={LOAN_STATE_META.REQUESTED.tone} className="px-4 py-2.5 text-sm">
                  Anfrage läuft
                </Badge>
              ) : friendContext?.canRequest ? (
                <LoanRequestButton
                  userBookId={book.id}
                  bookTitle={book.title}
                  ownerName={book.owner.displayName}
                />
              ) : (
                <span className="text-sm text-ink-faint">
                  {book.owner.displayName} verleiht dieses Buch nicht.
                </span>
              )}

              <Button variant="ghost" onClick={onClose}>
                Schließen
              </Button>
            </div>

            {!owner ? (
              <p className="mt-4 text-xs text-ink-faint">
                Aus dem Regal von{" "}
                <Link href={`/friends/${book.owner.username}`} className="underline underline-offset-2">
                  @{book.owner.username}
                </Link>
              </p>
            ) : null}
          </motion.div>
        </div>
      </Modal>

      {owner ? (
        <ProgressDialog
          open={progressOpen}
          onClose={() => setProgressOpen(false)}
          userBookId={book.id}
          title={book.title}
          pageCount={book.pageCount}
          currentPage={book.currentPage}
        />
      ) : null}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
