"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { getBookAccess } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { formatDate } from "@/lib/format";
import type { ActionResult } from "@/server/actions/books";

function revalidateLoans(userBookId?: string) {
  revalidatePath("/loans");
  revalidatePath("/notifications");
  revalidatePath("/friends");
  revalidatePath("/");
  revalidatePath("/books");
  if (userBookId) revalidatePath(`/books/${userBookId}`);
}

/** Setzt den Ausleihstatus des Exemplars anhand offener Anfragen und Ausleihen. */
async function recalcLoanState(userBookId: string) {
  const [loan, pending] = await Promise.all([
    db.loan.findFirst({
      where: { userBookId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
      select: { status: true },
    }),
    db.loanRequest.count({ where: { userBookId, status: "PENDING" } }),
  ]);

  const loanState = loan
    ? loan.status === "RETURN_REQUESTED"
      ? "RETURN_REQUESTED"
      : "LENT"
    : pending > 0
      ? "REQUESTED"
      : "AVAILABLE";

  await db.userBook.update({ where: { id: userBookId }, data: { loanState } });
  return loanState;
}

/* ────────────────────────────────────────── Anfrage stellen */

export async function requestLoanAction(
  userBookId: string,
  message?: string,
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();

    const userBook = await db.userBook.findUnique({
      where: { id: userBookId },
      select: {
        id: true, userId: true, visibility: true, lendingEnabled: true, loanState: true, bookId: true,
        book: { select: { title: true } },
        user: { select: { displayName: true, username: true } },
      },
    });
    if (!userBook) return { ok: false, error: "Dieses Buch gibt es nicht." };

    // Serverseitige Berechtigungsprüfung – unabhängig davon, was das UI anzeigt.
    const access = await getBookAccess(user.id, userBook);
    if (!access.canSee) return { ok: false, error: "Du hast keinen Zugriff auf dieses Buch." };
    if (!access.canAskForLoan) {
      return { ok: false, error: "Für dieses Buch sind keine Ausleihanfragen möglich." };
    }

    const duplicate = await db.loanRequest.findFirst({
      where: { userBookId, requesterId: user.id, status: "PENDING" },
      select: { id: true },
    });
    if (duplicate) return { ok: false, error: "Du hast dieses Buch bereits angefragt." };

    await db.loanRequest.create({
      data: {
        userBookId,
        requesterId: user.id,
        ownerId: userBook.userId,
        status: "PENDING",
        message: message?.slice(0, 500) || null,
      },
    });
    await db.loanHistory.create({
      data: {
        userBookId,
        lenderId: userBook.userId,
        borrowerId: user.id,
        event: "REQUESTED",
        note: message?.slice(0, 500) || null,
      },
    });
    await recalcLoanState(userBookId);

    await notify({
      userId: userBook.userId,
      type: "LOAN_REQUEST",
      title: "📚 Neue Ausleihanfrage",
      body: `${user.displayName} möchte dein Buch „${userBook.book.title}“ ausleihen.`,
      href: "/loans",
      actorId: user.id,
      entityId: userBookId,
    });

    revalidateLoans(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function cancelLoanRequestAction(requestId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const request = await db.loanRequest.findUnique({
      where: { id: requestId },
      include: { userBook: { select: { id: true, book: { select: { title: true } } } } },
    });
    if (!request || request.requesterId !== user.id || request.status !== "PENDING") {
      return { ok: false, error: "Diese Anfrage ist nicht mehr offen." };
    }

    await db.loanRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    await db.loanHistory.create({
      data: {
        userBookId: request.userBookId,
        lenderId: request.ownerId,
        borrowerId: request.requesterId,
        event: "CANCELLED",
      },
    });
    await recalcLoanState(request.userBookId);

    await notify({
      userId: request.ownerId,
      type: "LOAN_CANCELLED",
      title: "Ausleihanfrage zurückgezogen",
      body: `${user.displayName} hat die Anfrage zu „${request.userBook.book.title}“ zurückgezogen.`,
      href: "/loans",
      actorId: user.id,
      entityId: request.userBookId,
    });

    revalidateLoans(request.userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/* ────────────────────────────────────────── Anfrage beantworten */

const acceptSchema = z.object({
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function acceptLoanRequestAction(
  requestId: string,
  input: z.input<typeof acceptSchema> = {},
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const parsed = acceptSchema.parse(input);

    const request = await db.loanRequest.findUnique({
      where: { id: requestId },
      include: {
        userBook: { select: { id: true, userId: true, book: { select: { title: true } } } },
        requester: { select: { id: true, displayName: true } },
      },
    });
    if (!request || request.ownerId !== user.id || request.status !== "PENDING") {
      return { ok: false, error: "Diese Anfrage ist nicht mehr offen." };
    }
    if (request.userBook.userId !== user.id) return { ok: false, error: "Das ist nicht dein Buch." };

    const active = await db.loan.findFirst({
      where: { userBookId: request.userBookId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
      select: { id: true },
    });
    if (active) return { ok: false, error: "Dieses Exemplar ist bereits verliehen." };

    const startDate = parsed.startDate ? new Date(parsed.startDate) : new Date();
    const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;

    const loan = await db.loan.create({
      data: {
        userBookId: request.userBookId,
        requestId: request.id,
        lenderId: user.id,
        borrowerId: request.requesterId,
        status: "ACTIVE",
        startDate,
        dueDate,
        note: parsed.note || null,
      },
    });

    await db.loanRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    // Weitere offene Anfragen für dasselbe Exemplar zurückstellen.
    const others = await db.loanRequest.findMany({
      where: { userBookId: request.userBookId, status: "PENDING", id: { not: requestId } },
      select: { id: true, requesterId: true },
    });
    if (others.length) {
      await db.loanRequest.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      for (const other of others) {
        await notify({
          userId: other.requesterId,
          type: "LOAN_CANCELLED",
          title: "Buch inzwischen verliehen",
          body: `„${request.userBook.book.title}“ ist gerade an jemand anderen verliehen.`,
          href: "/loans",
          actorId: user.id,
          entityId: request.userBookId,
        });
      }
    }

    await db.loanHistory.create({
      data: {
        userBookId: request.userBookId,
        loanId: loan.id,
        lenderId: user.id,
        borrowerId: request.requesterId,
        event: "ACCEPTED",
        fromDate: startDate,
        toDate: dueDate,
        note: parsed.note || null,
      },
    });
    await recalcLoanState(request.userBookId);

    await notify({
      userId: request.requesterId,
      type: "LOAN_ACCEPTED",
      title: "Ausleihe bestätigt",
      body: dueDate
        ? `${user.displayName} leiht dir „${request.userBook.book.title}“ bis ${formatDate(dueDate)}.`
        : `${user.displayName} leiht dir „${request.userBook.book.title}“.`,
      href: "/loans",
      actorId: user.id,
      entityId: loan.id,
    });

    revalidateLoans(request.userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function declineLoanRequestAction(requestId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const request = await db.loanRequest.findUnique({
      where: { id: requestId },
      include: { userBook: { select: { book: { select: { title: true } } } } },
    });
    if (!request || request.ownerId !== user.id || request.status !== "PENDING") {
      return { ok: false, error: "Diese Anfrage ist nicht mehr offen." };
    }

    await db.loanRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await db.loanHistory.create({
      data: {
        userBookId: request.userBookId,
        lenderId: request.ownerId,
        borrowerId: request.requesterId,
        event: "DECLINED",
      },
    });
    await recalcLoanState(request.userBookId);

    await notify({
      userId: request.requesterId,
      type: "LOAN_DECLINED",
      title: "Ausleihe abgelehnt",
      body: `${user.displayName} kann „${request.userBook.book.title}“ gerade nicht verleihen.`,
      href: "/loans",
      actorId: user.id,
      entityId: request.userBookId,
    });

    revalidateLoans(request.userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/* ────────────────────────────────────────── Rückgabe */

export async function requestReturnAction(loanId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        userBook: { select: { id: true, book: { select: { title: true } } } },
        lender: { select: { id: true, displayName: true } },
        borrower: { select: { id: true, displayName: true } },
      },
    });
    if (!loan || loan.status !== "ACTIVE") return { ok: false, error: "Diese Ausleihe läuft nicht mehr." };
    if (loan.lenderId !== user.id && loan.borrowerId !== user.id) {
      return { ok: false, error: "Das betrifft dich nicht." };
    }

    await db.loan.update({ where: { id: loanId }, data: { status: "RETURN_REQUESTED" } });
    await db.loanHistory.create({
      data: {
        userBookId: loan.userBookId,
        loanId: loan.id,
        lenderId: loan.lenderId,
        borrowerId: loan.borrowerId,
        event: "RETURN_REQUESTED",
      },
    });
    await recalcLoanState(loan.userBookId);

    const byLender = loan.lenderId === user.id;
    await notify({
      userId: byLender ? loan.borrowerId : loan.lenderId,
      type: "RETURN_REQUESTED",
      title: "Rückgabe angefragt",
      body: byLender
        ? `${user.displayName} möchte „${loan.userBook.book.title}“ zurück.`
        : `${user.displayName} möchte „${loan.userBook.book.title}“ zurückgeben.`,
      href: "/loans",
      actorId: user.id,
      entityId: loan.id,
    });

    revalidateLoans(loan.userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/** Nur der Besitzer bestätigt die Rückgabe – danach ist das Buch wieder verfügbar. */
export async function confirmReturnAction(loanId: string, note?: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        userBook: { select: { id: true, book: { select: { title: true } } } },
        borrower: { select: { id: true, displayName: true } },
      },
    });
    if (!loan || loan.status === "RETURNED") return { ok: false, error: "Diese Ausleihe ist abgeschlossen." };
    if (loan.lenderId !== user.id) return { ok: false, error: "Nur der Besitzer kann die Rückgabe bestätigen." };

    const returnedAt = new Date();
    await db.loan.update({
      where: { id: loanId },
      data: { status: "RETURNED", returnedAt, note: note?.slice(0, 500) ?? loan.note },
    });
    await db.loanHistory.create({
      data: {
        userBookId: loan.userBookId,
        loanId: loan.id,
        lenderId: loan.lenderId,
        borrowerId: loan.borrowerId,
        event: "RETURNED",
        fromDate: loan.startDate,
        toDate: returnedAt,
        note: note?.slice(0, 500) || null,
      },
    });
    await recalcLoanState(loan.userBookId);

    await notify({
      userId: loan.borrowerId,
      type: "RETURN_CONFIRMED",
      title: "Rückgabe bestätigt",
      body: `${user.displayName} hat die Rückgabe von „${loan.userBook.book.title}“ bestätigt. Danke!`,
      href: "/loans",
      actorId: user.id,
      entityId: loan.id,
    });

    revalidateLoans(loan.userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function updateLoanDueDateAction(loanId: string, dueDate: string | null): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const loan = await db.loan.findUnique({ where: { id: loanId }, select: { lenderId: true, userBookId: true } });
    if (!loan || loan.lenderId !== user.id) return { ok: false, error: "Nur der Besitzer kann das ändern." };

    await db.loan.update({
      where: { id: loanId },
      data: { dueDate: dueDate ? new Date(dueDate) : null },
    });
    revalidateLoans(loan.userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

function msg(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Ungültige Eingabe.";
  const text = error instanceof Error ? error.message : String(error);
  if (text === "UNAUTHORIZED") return "Bitte melde dich an.";
  console.error("[loans]", error);
  return "Das hat nicht funktioniert. Bitte versuche es erneut.";
}
