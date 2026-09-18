import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, HandHeart, Inbox, PackageCheck, Send } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getLoanOverview, type LoanDTO, type LoanRequestDTO } from "@/server/queries/loans";
import { ensureDueSoonNotifications } from "@/lib/notifications";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/ui/book-cover";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AcceptRequestButton, CancelRequestButton, ConfirmReturnButton,
  DeclineRequestButton, RequestReturnButton,
} from "@/components/loans/loan-actions";
import { LOAN_REQUEST_STATUS_LABEL, LOAN_STATUS_LABEL } from "@/lib/constants";
import { daysUntil, formatDate, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Ausleihen" };

export default async function LoansPage() {
  const user = await requireUser();

  // Fällige Rückgaben erzeugen – idempotent, daher beim Öffnen unkritisch.
  await ensureDueSoonNotifications(user.id);

  const { incoming, outgoing, lentOut, borrowed, finished } = await getLoanOverview(user.id);

  const overdue = [...lentOut, ...borrowed].filter(
    (loan) => loan.dueDate && daysUntil(loan.dueDate) < 0,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">Ausleihen</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Anfragen, laufende Ausleihen und die Historie – alles an einem Ort.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {incoming.length ? (
            <Badge tone="bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200">
              {pluralize(incoming.length, "offene Anfrage", "offene Anfragen")}
            </Badge>
          ) : null}
          <Badge>{pluralize(lentOut.length, "Buch verliehen", "Bücher verliehen")}</Badge>
          <Badge>{pluralize(borrowed.length, "Buch geliehen", "Bücher geliehen")}</Badge>
          {overdue ? (
            <Badge tone="bg-clay-100 text-clay-700 dark:bg-clay-500/25 dark:text-clay-100">
              {pluralize(overdue, "Rückgabe überfällig", "Rückgaben überfällig")}
            </Badge>
          ) : null}
        </div>
      </header>

      {/* Eingehende Anfragen */}
      <Card>
        <CardHeader
          title="Anfragen an dich"
          subtitle="Du entscheidest, ob und wie lange du verleihst."
        />
        <CardBody>
          {incoming.length ? (
            <ul className="flex flex-col gap-4">
              {incoming.map((request) => (
                <RequestRow key={request.id} request={request} direction="incoming" />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Inbox size={20} />}
              title="Keine offenen Anfragen"
              description="Sobald ein Freund ein Buch aus deinem Regal anfragt, erscheint es hier."
              className="py-10"
            />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verliehen */}
        <Card>
          <CardHeader title="Von dir verliehen" subtitle="Rückgabe bestätigst du selbst." />
          <CardBody>
            {lentOut.length ? (
              <ul className="flex flex-col gap-4">
                {lentOut.map((loan) => (
                  <LoanRow key={loan.id} loan={loan} role="lender" />
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-ink-faint">Gerade ist kein Buch von dir unterwegs.</p>
            )}
          </CardBody>
        </Card>

        {/* Ausgeliehen */}
        <Card>
          <CardHeader title="Von Freunden geliehen" subtitle="Bitte pünktlich zurückgeben ✨" />
          <CardBody>
            {borrowed.length ? (
              <ul className="flex flex-col gap-4">
                {borrowed.map((loan) => (
                  <LoanRow key={loan.id} loan={loan} role="borrower" />
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-ink-faint">Du hast aktuell kein Buch ausgeliehen.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Eigene Anfragen */}
      {outgoing.length ? (
        <Card>
          <CardHeader title="Deine Anfragen" subtitle="Status deiner gestellten Ausleihanfragen." />
          <CardBody>
            <ul className="flex flex-col gap-4">
              {outgoing.map((request) => (
                <RequestRow key={request.id} request={request} direction="outgoing" />
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* Historie */}
      <Card>
        <CardHeader title="Ausleihhistorie" subtitle="Abgeschlossene Ausleihen – deine und die deiner Bücher." />
        <CardBody>
          {finished.length ? (
            <ul className="flex flex-col divide-y divide-ink/6 dark:divide-white/6">
              {finished.map((loan) => (
                <li key={loan.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-14 w-10 shrink-0 shadow-soft">
                    <BookCover
                      title={loan.userBook.title}
                      author={loan.userBook.author}
                      coverUrl={loan.userBook.coverUrl}
                      textScale={0.35}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/books/${loan.userBook.id}`} className="truncate text-sm text-ink hover:underline">
                      {loan.userBook.title}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      {loan.lender.displayName} → {loan.borrower.displayName} ·{" "}
                      {formatDate(loan.startDate)} – {formatDate(loan.returnedAt)}
                    </p>
                    {loan.note ? <p className="mt-0.5 text-xs text-ink-soft">„{loan.note}“</p> : null}
                  </div>
                  <Badge>
                    <PackageCheck size={11} />
                    {LOAN_STATUS_LABEL.RETURNED}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">Noch keine abgeschlossene Ausleihe.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function RequestRow({
  request,
  direction,
}: {
  request: LoanRequestDTO;
  direction: "incoming" | "outgoing";
}) {
  const person = direction === "incoming" ? request.requester : request.owner;

  return (
    <li className="rounded-2xl border border-ink/8 bg-surface-muted/50 p-4 dark:border-white/8 dark:bg-white/4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="h-20 w-14 shrink-0 shadow-book">
          <BookCover
            title={request.userBook.title}
            author={request.userBook.author}
            coverUrl={request.userBook.coverUrl}
            textScale={0.45}
          />
        </div>

        <div className="min-w-0 flex-1">
          <Link href={`/books/${request.userBook.id}`} className="text-sm font-medium text-ink hover:underline">
            {request.userBook.title}
          </Link>
          <p className="text-xs text-ink-faint">{request.userBook.author}</p>

          <div className="mt-2 flex items-center gap-2">
            <Avatar name={person.displayName} accentColor={person.accentColor} size="xs" />
            <p className="text-xs text-ink-soft">
              {direction === "incoming"
                ? `${person.displayName} möchte ausleihen`
                : `angefragt bei ${person.displayName}`}{" "}
              · {formatRelative(request.createdAt)}
            </p>
          </div>

          {request.message ? (
            <p className="mt-2 rounded-xl bg-surface/80 px-3 py-2 text-sm text-ink-soft">„{request.message}“</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {direction === "incoming" ? (
              <>
                <AcceptRequestButton
                  requestId={request.id}
                  bookTitle={request.userBook.title}
                  requesterName={person.displayName}
                />
                <DeclineRequestButton requestId={request.id} bookTitle={request.userBook.title} />
              </>
            ) : request.status === "PENDING" ? (
              <>
                <Badge tone="bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200">
                  <Send size={11} />
                  {LOAN_REQUEST_STATUS_LABEL.PENDING}
                </Badge>
                <CancelRequestButton requestId={request.id} />
              </>
            ) : (
              <Badge>{LOAN_REQUEST_STATUS_LABEL[request.status as "DECLINED"]}</Badge>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function LoanRow({ loan, role }: { loan: LoanDTO; role: "lender" | "borrower" }) {
  const person = role === "lender" ? loan.borrower : loan.lender;
  const due = loan.dueDate ? daysUntil(loan.dueDate) : null;

  return (
    <li className="rounded-2xl border border-ink/8 bg-surface-muted/50 p-4 dark:border-white/8 dark:bg-white/4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="h-20 w-14 shrink-0 shadow-book">
          <BookCover
            title={loan.userBook.title}
            author={loan.userBook.author}
            coverUrl={loan.userBook.coverUrl}
            textScale={0.45}
          />
        </div>

        <div className="min-w-0 flex-1">
          <Link href={`/books/${loan.userBook.id}`} className="text-sm font-medium text-ink hover:underline">
            {loan.userBook.title}
          </Link>
          <div className="mt-1.5 flex items-center gap-2">
            <Avatar name={person.displayName} accentColor={person.accentColor} size="xs" />
            <p className="text-xs text-ink-soft">
              {role === "lender" ? `bei ${person.displayName}` : `von ${person.displayName}`} · seit{" "}
              {formatDate(loan.startDate)}
            </p>
          </div>

          <p
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 text-xs",
              due !== null && due < 0
                ? "text-clay-700 dark:text-clay-200"
                : due !== null && due <= 3
                  ? "text-honey-500"
                  : "text-ink-faint",
            )}
          >
            <CalendarClock size={12} />
            {loan.dueDate
              ? due !== null && due < 0
                ? `${Math.abs(due)} Tage überfällig (${formatDate(loan.dueDate)})`
                : due === 0
                  ? `heute fällig`
                  : `Rückgabe in ${due} Tagen (${formatDate(loan.dueDate)})`
              : "ohne Rückgabefrist"}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {loan.status === "RETURN_REQUESTED" ? (
              <Badge tone="bg-plum-100 text-plum-500 dark:bg-plum-400/20 dark:text-plum-200">
                <HandHeart size={11} />
                Rückgabe angefragt
              </Badge>
            ) : null}

            {role === "lender" ? (
              <>
                {loan.status === "ACTIVE" ? <RequestReturnButton loanId={loan.id} asLender /> : null}
                <ConfirmReturnButton
                  loanId={loan.id}
                  bookTitle={loan.userBook.title}
                  borrowerName={loan.borrower.displayName}
                />
              </>
            ) : loan.status === "ACTIVE" ? (
              <RequestReturnButton loanId={loan.id} asLender={false} />
            ) : (
              <span className="text-xs text-ink-faint">
                {loan.lender.displayName} bestätigt die Rückgabe.
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
