import "server-only";

import { db } from "@/lib/db";

const userSelect = { id: true, displayName: true, username: true, accentColor: true } as const;

const bookSelect = {
  id: true,
  coverOverride: true,
  userId: true,
  book: { select: { title: true, author: true, coverUrl: true } },
  user: { select: userSelect },
} as const;

export type LoanPerson = { id: string; displayName: string; username: string; accentColor: string };

export type LoanRequestDTO = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  requester: LoanPerson;
  owner: LoanPerson;
  userBook: { id: string; title: string; author: string; coverUrl: string | null };
};

export type LoanDTO = {
  id: string;
  status: string;
  startDate: string;
  dueDate: string | null;
  returnedAt: string | null;
  note: string | null;
  lender: LoanPerson;
  borrower: LoanPerson;
  userBook: { id: string; title: string; author: string; coverUrl: string | null };
};

export type LoanHistoryDTO = {
  id: string;
  event: string;
  fromDate: string | null;
  toDate: string | null;
  note: string | null;
  createdAt: string;
  lenderName: string;
  borrowerName: string;
};

const mapBook = (row: {
  id: string;
  coverOverride: string | null;
  book: { title: string; author: string; coverUrl: string | null };
}) => ({
  id: row.id,
  title: row.book.title,
  author: row.book.author,
  coverUrl: row.coverOverride ?? row.book.coverUrl,
});

function mapRequest(row: {
  id: string;
  status: string;
  message: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  requester: LoanPerson;
  owner: LoanPerson;
  userBook: { id: string; coverOverride: string | null; book: { title: string; author: string; coverUrl: string | null } };
}): LoanRequestDTO {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    requester: row.requester,
    owner: row.owner,
    userBook: mapBook(row.userBook),
  };
}

function mapLoan(row: {
  id: string;
  status: string;
  startDate: Date;
  dueDate: Date | null;
  returnedAt: Date | null;
  note: string | null;
  lender: LoanPerson;
  borrower: LoanPerson;
  userBook: { id: string; coverOverride: string | null; book: { title: string; author: string; coverUrl: string | null } };
}): LoanDTO {
  return {
    id: row.id,
    status: row.status,
    startDate: row.startDate.toISOString(),
    dueDate: row.dueDate?.toISOString() ?? null,
    returnedAt: row.returnedAt?.toISOString() ?? null,
    note: row.note,
    lender: row.lender,
    borrower: row.borrower,
    userBook: mapBook(row.userBook),
  };
}

/** Ausleihkontext eines einzelnen Exemplars (für die Buchseite). */
export async function getBookLoanContext(userBookId: string) {
  const [activeLoan, pendingRequests, history] = await Promise.all([
    db.loan.findFirst({
      where: { userBookId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
      include: { lender: { select: userSelect }, borrower: { select: userSelect }, userBook: { select: bookSelect } },
    }),
    db.loanRequest.findMany({
      where: { userBookId, status: "PENDING" },
      include: { requester: { select: userSelect }, owner: { select: userSelect }, userBook: { select: bookSelect } },
      orderBy: { createdAt: "asc" },
    }),
    db.loanHistory.findMany({
      where: { userBookId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { loan: { select: { lender: { select: { displayName: true } }, borrower: { select: { displayName: true } } } } },
    }),
  ]);

  const people = await db.user.findMany({
    where: { id: { in: [...new Set(history.flatMap((h) => [h.lenderId, h.borrowerId]))] } },
    select: { id: true, displayName: true },
  });
  const names = new Map(people.map((p) => [p.id, p.displayName]));

  return {
    activeLoan: activeLoan ? mapLoan(activeLoan) : null,
    pendingRequests: pendingRequests.map(mapRequest),
    history: history.map<LoanHistoryDTO>((entry) => ({
      id: entry.id,
      event: entry.event,
      fromDate: entry.fromDate?.toISOString() ?? null,
      toDate: entry.toDate?.toISOString() ?? null,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      lenderName: names.get(entry.lenderId) ?? "—",
      borrowerName: names.get(entry.borrowerId) ?? "—",
    })),
  };
}

/** Übersicht aller Ausleihvorgänge eines Benutzers (für /loans). */
export async function getLoanOverview(userId: string) {
  const [incoming, outgoing, lentOut, borrowed, finished] = await Promise.all([
    db.loanRequest.findMany({
      where: { ownerId: userId, status: "PENDING" },
      include: { requester: { select: userSelect }, owner: { select: userSelect }, userBook: { select: bookSelect } },
      orderBy: { createdAt: "desc" },
    }),
    db.loanRequest.findMany({
      where: { requesterId: userId, status: { in: ["PENDING", "DECLINED"] } },
      include: { requester: { select: userSelect }, owner: { select: userSelect }, userBook: { select: bookSelect } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.loan.findMany({
      where: { lenderId: userId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
      include: { lender: { select: userSelect }, borrower: { select: userSelect }, userBook: { select: bookSelect } },
      orderBy: { startDate: "desc" },
    }),
    db.loan.findMany({
      where: { borrowerId: userId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
      include: { lender: { select: userSelect }, borrower: { select: userSelect }, userBook: { select: bookSelect } },
      orderBy: { startDate: "desc" },
    }),
    db.loan.findMany({
      where: { status: "RETURNED", OR: [{ lenderId: userId }, { borrowerId: userId }] },
      include: { lender: { select: userSelect }, borrower: { select: userSelect }, userBook: { select: bookSelect } },
      orderBy: { returnedAt: "desc" },
      take: 30,
    }),
  ]);

  return {
    incoming: incoming.map(mapRequest),
    outgoing: outgoing.map(mapRequest),
    lentOut: lentOut.map(mapLoan),
    borrowed: borrowed.map(mapLoan),
    finished: finished.map(mapLoan),
  };
}

/** Offene eigene Anfrage zu einem Exemplar – verhindert Doppelanfragen im UI. */
export async function getMyPendingRequest(userId: string, userBookId: string) {
  return db.loanRequest.findFirst({
    where: { userBookId, requesterId: userId, status: "PENDING" },
    select: { id: true, createdAt: true },
  });
}
