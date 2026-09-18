import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, BookOpen, Brush, CalendarDays, CheckCircle2, Hash, Languages,
  Library, Palette, Sparkles, Tag as TagIcon, Users,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findAccessibleUserBook, friendIds } from "@/lib/permissions";
import { getFriendsOwningBook, getUserBookById } from "@/server/queries/books";
import { getAnsweredQuestions } from "@/server/queries/questions";
import { getDrawings, getMoodboard } from "@/server/queries/moodboard";
import { getBookLoanContext, getMyPendingRequest } from "@/server/queries/loans";

import { BookCover } from "@/components/ui/book-cover";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ReadingProgressLine } from "@/components/ui/progress";
import { Stars } from "@/components/ui/rating";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/books/status-badge";
import { StatusSelect } from "@/components/books/status-select";
import { RatingInput } from "@/components/books/rating-input";
import { NotesEditor } from "@/components/books/notes-editor";
import { TagEditor } from "@/components/books/tag-editor";
import { SharingControls } from "@/components/books/sharing-controls";
import { BookActions } from "@/components/books/book-actions";
import { ReadingDates } from "@/components/books/reading-dates";
import { AnswerValue } from "@/components/questions/answer-value";
import { MoodboardPreview } from "@/components/moodboard/moodboard-preview";
import { LoanRequestButton } from "@/components/loans/loan-request-button";
import {
  AcceptRequestButton, ConfirmReturnButton, DeclineRequestButton, RequestReturnButton,
} from "@/components/loans/loan-actions";

import {
  LANGUAGE_LABEL, LOAN_EVENT_LABEL, LOAN_STATE_META, READING_STATUS_META,
} from "@/lib/constants";
import { daysUntil, formatDate, formatNumber, formatRelative, pluralize } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const book = await db.userBook.findUnique({
    where: { id },
    select: { book: { select: { title: true } } },
  });
  return { title: book?.book.title ?? "Buch" };
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  // Zugriff serverseitig prüfen – fremde private Bücher sind nicht erreichbar.
  const access = await findAccessibleUserBook(user.id, id);
  if (!access) notFound();

  const book = await getUserBookById(id);
  if (!book) notFound();

  const isOwner = access.isOwner;
  const [genres, loanContext, myRequest, friends] = await Promise.all([
    isOwner
      ? db.genre.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } })
      : Promise.resolve([]),
    getBookLoanContext(book.id),
    isOwner ? Promise.resolve(null) : getMyPendingRequest(user.id, book.id),
    friendIds(user.id),
  ]);

  const [answers, moodboard, drawings, myTags, ownSameBook, friendsOwning] = await Promise.all([
    isOwner ? getAnsweredQuestions(book.id) : Promise.resolve([]),
    isOwner ? getMoodboard(book.id) : Promise.resolve(null),
    isOwner ? getDrawings(book.id) : Promise.resolve([]),
    isOwner
      ? db.tag.findMany({ where: { userId: user.id }, select: { name: true }, orderBy: { name: "asc" }, take: 30 })
      : Promise.resolve([]),
    isOwner
      ? Promise.resolve(null)
      : db.userBook.findUnique({
          where: { userId_bookId: { userId: user.id, bookId: book.bookId } },
          select: { id: true },
        }),
    getFriendsOwningBook(book.bookId, friends, isOwner ? user.id : book.owner.id),
  ]);

  const statusMeta = READING_STATUS_META[book.status];
  const dueIn = loanContext.activeLoan?.dueDate ? daysUntil(loanContext.activeLoan.dueDate) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={isOwner ? "/books" : `/friends/${book.owner.username}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        {isOwner ? "Zur Bibliothek" : `Regal von ${book.owner.displayName}`}
      </Link>

      {/* ── Buchkopf: wie eine aufgeschlagene Buchseite ───────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-ink/8 bg-gradient-to-br from-surface via-surface to-paper-soft/70 shadow-soft dark:border-white/8 dark:to-surface-muted">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: `radial-gradient(at 88% 8%, ${book.genres[0]?.tint ?? "#e8d9c5"}55 0px, transparent 55%)`,
          }}
        />
        <div className="relative flex flex-col gap-7 p-5 sm:p-8 lg:flex-row lg:gap-10">
          <div className="mx-auto w-44 shrink-0 sm:w-52 lg:mx-0">
            <div className="aspect-2/3 rotate-[-1.5deg] shadow-book transition-transform duration-500 hover:rotate-0">
              <BookCover
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                textScale={1.5}
                priority
              />
            </div>

            {isOwner ? (
              <div className="mt-5 flex flex-col items-center gap-3 lg:items-start">
                <StatusSelect userBookId={book.id} status={book.status} />
                <BookActions book={book} genres={genres} />
              </div>
            ) : (
              <div className="mt-5 flex flex-col items-center gap-3 lg:items-start">
                <StatusBadge status={book.status} />
                {ownSameBook ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3.5 py-2 text-xs text-sage-500 dark:bg-sage-500/15 dark:text-sage-200">
                    <CheckCircle2 size={14} />
                    Du besitzt dieses Buch bereits.
                  </span>
                ) : myRequest ? (
                  <Badge tone={LOAN_STATE_META.REQUESTED.tone}>
                    Anfrage läuft seit {formatRelative(myRequest.createdAt.toISOString())}
                  </Badge>
                ) : access.canAskForLoan ? (
                  <LoanRequestButton
                    userBookId={book.id}
                    bookTitle={book.title}
                    ownerName={book.owner.displayName}
                  />
                ) : book.lendingEnabled && book.loanState !== "AVAILABLE" ? (
                  <Badge tone={LOAN_STATE_META[book.loanState].tone}>
                    {LOAN_STATE_META[book.loanState].label} – gerade nicht verfügbar
                  </Badge>
                ) : (
                  <span className="text-xs text-ink-faint">
                    {book.owner.displayName} verleiht dieses Buch nicht.
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {book.genres.map((genre) => (
                <Link key={genre.slug} href={`/books?genre=${genre.slug}`}>
                  <Badge className="bg-paper-deep/70 hover:bg-paper-deep dark:bg-white/10">
                    {genre.emoji} {genre.name}
                  </Badge>
                </Link>
              ))}
              {book.favorite ? (
                <Badge tone="bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200">
                  ★ Favorit
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight text-ink sm:text-4xl">
              {book.title}
            </h1>
            {book.subtitle ? <p className="mt-1.5 text-lg text-ink-soft">{book.subtitle}</p> : null}
            <p className="mt-2 text-ink-soft">von {book.author}</p>

            {!isOwner ? (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-ink/8 bg-surface/80 px-3.5 py-2.5 dark:border-white/8">
                <Avatar name={book.owner.displayName} accentColor={book.owner.accentColor} size="sm" />
                <div className="min-w-0 text-sm">
                  <p className="text-ink">📚 Im Besitz von {book.owner.displayName}</p>
                  <p className="text-xs text-ink-faint">
                    {book.lendingEnabled
                      ? LOAN_STATE_META[book.loanState].label
                      : "Ausleihe nicht aktiviert"}
                  </p>
                </div>
              </div>
            ) : null}

            {book.description ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">
                {book.description}
              </p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3.5 text-sm sm:grid-cols-3">
              <Meta icon={<BookOpen size={14} />} label="Seiten" value={book.pageCount ? formatNumber(book.pageCount) : "—"} />
              <Meta icon={<CalendarDays size={14} />} label="Erschienen" value={book.publishedYear ? String(book.publishedYear) : "—"} />
              <Meta icon={<Library size={14} />} label="Verlag" value={book.publisher ?? "—"} />
              <Meta icon={<Languages size={14} />} label="Sprache" value={LANGUAGE_LABEL(book.language)} />
              <Meta icon={<Hash size={14} />} label="ISBN" value={book.isbn ?? "—"} />
              {isOwner ? (
                <Meta icon={<CalendarDays size={14} />} label="Hinzugefügt" value={formatDate(book.addedAt)} />
              ) : null}
            </dl>

            {/* Lesefortschritt */}
            <div className="mt-7 rounded-2xl border border-ink/8 bg-surface/70 p-4 sm:p-5 dark:border-white/8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base text-ink">
                  {statusMeta.emoji} {statusMeta.label}
                </h2>
                {isOwner && book.rating ? <Stars value={book.rating} showValue /> : null}
              </div>

              {book.status === "READING" || book.currentPage > 0 ? (
                <ReadingProgressLine currentPage={book.currentPage} pageCount={book.pageCount} />
              ) : (
                <p className="text-sm text-ink-faint">Noch kein Lesefortschritt erfasst.</p>
              )}

              {isOwner ? (
                <div className="mt-4 border-t border-ink/8 pt-4 dark:border-white/8">
                  <ReadingDates
                    userBookId={book.id}
                    startedAt={book.startedAt}
                    finishedAt={book.finishedAt}
                    readingMinutes={null}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {isOwner ? (
        <>
          {/* ── Bewertung & Notizen ───────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Deine Bewertung" subtitle="Ganz persönlich, von 1 bis 10." />
              <CardBody>
                <RatingInput userBookId={book.id} rating={book.rating} />
                <div className="mt-5 border-t border-ink/8 pt-4 dark:border-white/8">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
                    <TagIcon size={14} className="text-ink-faint" />
                    Tags
                  </p>
                  <TagEditor userBookId={book.id} tags={book.tags} suggestions={myTags.map((t) => t.name)} />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Deine Notizen"
                subtitle="Dein Buch-Tagebuch – nur für dich sichtbar."
              />
              <CardBody>
                <NotesEditor userBookId={book.id} notes={book.notes} />
              </CardBody>
            </Card>
          </div>

          {/* ── Fragebogen ────────────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Deine Antworten"
              subtitle={
                answers.length
                  ? `${pluralize(answers.length, "Frage beantwortet", "Fragen beantwortet")} · passend zu ${book.genres.map((g) => g.name).join(", ") || "diesem Buch"}`
                  : "Der Fragebogen passt sich den Genres des Buches an."
              }
              action={
                <ButtonLink href={`/books/${book.id}/questionnaire`} variant="soft" size="sm">
                  <Sparkles size={15} />
                  {answers.length ? "Bearbeiten" : "Ausfüllen"}
                </ButtonLink>
              }
            />
            <CardBody>
              {answers.length ? (
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {answers.map((answer) => (
                    <div key={answer.id} className="min-w-0">
                      <dt className="flex items-baseline gap-1.5 text-sm text-ink">
                        {answer.genreEmoji ? <span aria-hidden>{answer.genreEmoji}</span> : null}
                        {answer.prompt}
                      </dt>
                      <dd className="mt-1.5">
                        <AnswerValue type={answer.type} value={answer.value} config={answer.config} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-ink-faint">
                  Noch keine Antworten. Der Fragebogen enthält allgemeine Fragen und zusätzlich
                  Fragen zu {book.genres.map((g) => g.name).join(", ") || "den Genres des Buches"}.
                </p>
              )}
            </CardBody>
          </Card>

          {/* ── Moodboard & Zeichnungen ───────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader
                title="Moodboard"
                subtitle="Bilder, Farben, Notizen – frei angeordnet."
                action={
                  <ButtonLink href={`/books/${book.id}/moodboard`} variant="soft" size="sm">
                    <Palette size={15} />
                    {moodboard ? "Bearbeiten" : "Anlegen"}
                  </ButtonLink>
                }
              />
              <CardBody>
                {moodboard && moodboard.elements.length ? (
                  <MoodboardPreview moodboard={moodboard} href={`/books/${book.id}/moodboard`} />
                ) : (
                  <Link
                    href={`/books/${book.id}/moodboard`}
                    className="flex aspect-5/3 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/12 text-center transition-colors hover:border-clay-300 dark:border-white/12"
                  >
                    <Palette size={22} className="text-ink-faint" />
                    <span className="text-sm text-ink-soft">Moodboard für dieses Buch gestalten</span>
                    <span className="text-xs text-ink-faint">Bilder, Texte, Farben und Zeichnungen</span>
                  </Link>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Zeichnungen"
                subtitle={drawings.length ? pluralize(drawings.length, "Skizze", "Skizzen") : "Mit Stift oder Finger"}
                action={
                  <ButtonLink href={`/books/${book.id}/moodboard?tool=draw`} variant="soft" size="sm">
                    <Brush size={15} />
                    Zeichnen
                  </ButtonLink>
                }
              />
              <CardBody>
                {drawings.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {drawings.slice(0, 4).map((drawing) => (
                      <div
                        key={drawing.id}
                        className="overflow-hidden rounded-xl border border-ink/8 bg-white p-1 dark:border-white/10"
                      >
                        <img
                          src={drawing.dataUrl}
                          alt={drawing.title ?? "Zeichnung"}
                          className="aspect-4/3 w-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">
                    Noch keine Zeichnung. Der Canvas funktioniert auch mit Finger und Stift.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>

          {/* ── Ausleihe ──────────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Teilen & Ausleihen" subtitle="Gilt nur für dieses Exemplar." />
              <CardBody>
                <SharingControls
                  userBookId={book.id}
                  visibility={book.visibility}
                  lendingEnabled={book.lendingEnabled}
                />

                <div className="mt-5 border-t border-ink/8 pt-4 dark:border-white/8">
                  <p className="mb-2 text-sm font-medium text-ink">Status</p>
                  <Badge tone={LOAN_STATE_META[book.loanState].tone}>
                    {LOAN_STATE_META[book.loanState].label}
                  </Badge>

                  {loanContext.activeLoan ? (
                    <div className="mt-4 rounded-2xl bg-paper-soft/80 p-4 dark:bg-white/5">
                      <p className="text-sm text-ink">
                        Verliehen an{" "}
                        <span className="font-medium">{loanContext.activeLoan.borrower.displayName}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        seit {formatDate(loanContext.activeLoan.startDate)}
                        {loanContext.activeLoan.dueDate
                          ? ` · Rückgabe ${formatDate(loanContext.activeLoan.dueDate)}${
                              dueIn !== null
                                ? dueIn < 0
                                  ? ` (${Math.abs(dueIn)} Tage überfällig)`
                                  : dueIn === 0
                                    ? " (heute)"
                                    : ` (in ${dueIn} Tagen)`
                                : ""
                            }`
                          : " · ohne Frist"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {loanContext.activeLoan.status === "ACTIVE" ? (
                          <RequestReturnButton loanId={loanContext.activeLoan.id} asLender />
                        ) : (
                          <Badge tone={LOAN_STATE_META.RETURN_REQUESTED.tone}>Rückgabe angefragt</Badge>
                        )}
                        <ConfirmReturnButton
                          loanId={loanContext.activeLoan.id}
                          bookTitle={book.title}
                          borrowerName={loanContext.activeLoan.borrower.displayName}
                        />
                      </div>
                    </div>
                  ) : null}

                  {loanContext.pendingRequests.length ? (
                    <div className="mt-4 flex flex-col gap-3">
                      {loanContext.pendingRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-honey-200 bg-honey-100/60 p-4 dark:border-honey-400/30 dark:bg-honey-400/10">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={request.requester.displayName} accentColor={request.requester.accentColor} size="sm" />
                            <div className="min-w-0 text-sm">
                              <p className="text-ink">
                                <span className="font-medium">{request.requester.displayName}</span> möchte
                                dieses Buch ausleihen
                              </p>
                              <p className="text-xs text-ink-faint">{formatRelative(request.createdAt)}</p>
                            </div>
                          </div>
                          {request.message ? (
                            <p className="mt-2.5 rounded-xl bg-surface/70 px-3 py-2 text-sm text-ink-soft">
                              „{request.message}“
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <AcceptRequestButton
                              requestId={request.id}
                              bookTitle={book.title}
                              requesterName={request.requester.displayName}
                            />
                            <DeclineRequestButton requestId={request.id} bookTitle={book.title} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Ausleihhistorie" subtitle="Nur für dich sichtbar." />
              <CardBody>
                {loanContext.history.length ? (
                  <ol className="flex flex-col gap-3">
                    {loanContext.history.map((entry) => (
                      <li key={entry.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-clay-300" />
                        <div className="min-w-0">
                          <p className="text-ink">
                            {LOAN_EVENT_LABEL[entry.event] ?? entry.event}
                            <span className="text-ink-faint">
                              {" "}
                              · {entry.lenderName} → {entry.borrowerName}
                            </span>
                          </p>
                          <p className="text-xs text-ink-faint">
                            {entry.fromDate
                              ? `${formatDate(entry.fromDate)}${entry.toDate ? ` – ${formatDate(entry.toDate)}` : ""}`
                              : formatDate(entry.createdAt)}
                          </p>
                          {entry.note ? <p className="mt-1 text-xs text-ink-soft">„{entry.note}“</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-ink-faint">Dieses Buch war noch nie verliehen.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardBody className="pt-5">
            <p className="text-sm text-ink-faint">
              Notizen, Bewertungsdetails, Moodboards und Zeichnungen von {book.owner.displayName} bleiben privat.
            </p>
          </CardBody>
        </Card>
      )}

      {/* ── Freunde mit demselben Buch ─────────────────────────────────── */}
      {friendsOwning.length ? (
        <Card>
          <CardHeader
            title={`${pluralize(friendsOwning.length, "Freund besitzt", "deiner Freunde besitzen")} dieses Buch`}
            subtitle="Nur Exemplare, die mit dir geteilt wurden."
          />
          <CardBody>
            <ul className="flex flex-col divide-y divide-ink/6 dark:divide-white/6">
              {friendsOwning.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Link href={`/friends/${entry.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={entry.user.displayName} accentColor={entry.user.accentColor} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{entry.user.displayName}</p>
                      <p className="text-xs text-ink-faint">
                        {READING_STATUS_META[entry.status as keyof typeof READING_STATUS_META]?.short ?? entry.status}
                        {entry.lendingEnabled ? " · verleiht dieses Buch" : ""}
                      </p>
                    </div>
                  </Link>
                  {entry.lendingEnabled && entry.loanState === "AVAILABLE" && !isOwner ? (
                    <LoanRequestButton
                      userBookId={entry.id}
                      bookTitle={book.title}
                      ownerName={entry.user.displayName}
                      variant="soft"
                      size="sm"
                      label="Anfragen"
                    />
                  ) : entry.loanState !== "AVAILABLE" ? (
                    <Badge tone={LOAN_STATE_META[entry.loanState as keyof typeof LOAN_STATE_META]?.tone}>
                      {LOAN_STATE_META[entry.loanState as keyof typeof LOAN_STATE_META]?.label}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
              <Users size={12} />
              Sichtbar sind nur Freunde, die dir ihr Regal freigegeben haben.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-ink">{value}</dd>
    </div>
  );
}
