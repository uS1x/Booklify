import "server-only";

import { db } from "@/lib/db";
import type { ShelfPermission } from "@/lib/constants";

/**
 * Zugriffsebene eines Betrachters auf ein fremdes Regal.
 * Wird ausschließlich serverseitig ermittelt – niemals im Client entschieden.
 */
export type ShelfAccess = "OWNER" | "REQUEST_LOAN" | "VIEW" | "NONE";

export const canView = (access: ShelfAccess) => access !== "NONE";
export const canRequestLoan = (access: ShelfAccess) => access === "REQUEST_LOAN";

export async function areFriends(a: string, b: string) {
  if (a === b) return true;
  const found = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

/** Alle bestätigten Freund-IDs eines Benutzers. */
export async function friendIds(userId: string) {
  const rows = await db.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/**
 * Regeln:
 *  1. Eigenes Regal → OWNER.
 *  2. Keine bestätigte Freundschaft → NONE (auch bei manipulierter URL).
 *  3. Explizite Mitgliedschaft → deren Berechtigung (VIEW | REQUEST_LOAN).
 *  4. Sonst: Regal auf „Mit Freunden geteilt“ → VIEW, andernfalls NONE.
 */
export async function getShelfAccess(viewerId: string, ownerId: string): Promise<ShelfAccess> {
  if (viewerId === ownerId) return "OWNER";
  if (!(await areFriends(viewerId, ownerId))) return "NONE";

  const shelf = await db.sharedShelf.findUnique({
    where: { ownerId },
    select: {
      id: true,
      visibility: true,
      members: { where: { userId: viewerId }, select: { permission: true } },
    },
  });
  if (!shelf) return "NONE";

  const member = shelf.members[0];
  if (member) return (member.permission as ShelfPermission) === "REQUEST_LOAN" ? "REQUEST_LOAN" : "VIEW";
  return shelf.visibility === "FRIENDS" ? "VIEW" : "NONE";
}

/** Sichtbarkeitsfilter für Prisma-Abfragen auf fremde Exemplare. */
export function visibleBookFilter(access: ShelfAccess) {
  return access === "OWNER" ? {} : { visibility: "FRIENDS" as const };
}

export type BookAccess = {
  access: ShelfAccess;
  isOwner: boolean;
  canSee: boolean;
  canAskForLoan: boolean;
};

/**
 * Prüft den Zugriff auf ein konkretes Exemplar. Private Exemplare bleiben
 * privat, selbst wenn das Regal insgesamt geteilt ist.
 */
export async function getBookAccess(
  viewerId: string,
  userBook: { userId: string; visibility: string; lendingEnabled: boolean; loanState: string },
): Promise<BookAccess> {
  const access = await getShelfAccess(viewerId, userBook.userId);
  const isOwner = access === "OWNER";
  const canSee = isOwner || (canView(access) && userBook.visibility === "FRIENDS");
  const canAskForLoan =
    !isOwner &&
    canSee &&
    canRequestLoan(access) &&
    userBook.lendingEnabled &&
    userBook.loanState === "AVAILABLE";
  return { access, isOwner, canSee, canAskForLoan };
}

/** Lädt ein Exemplar nur, wenn der Betrachter es sehen darf – sonst null. */
export async function findAccessibleUserBook(viewerId: string, userBookId: string) {
  const userBook = await db.userBook.findUnique({
    where: { id: userBookId },
    select: { id: true, userId: true, visibility: true, lendingEnabled: true, loanState: true },
  });
  if (!userBook) return null;
  const access = await getBookAccess(viewerId, userBook);
  if (!access.canSee) return null;
  return { userBook, ...access };
}

/** Exemplar, das dem Aufrufer selbst gehört – für alle schreibenden Aktionen. */
export async function requireOwnedUserBook(userId: string, userBookId: string) {
  const userBook = await db.userBook.findFirst({
    where: { id: userBookId, userId },
    select: { id: true, userId: true, bookId: true, status: true, currentPage: true, loanState: true },
  });
  if (!userBook) throw new Error("NOT_FOUND");
  return userBook;
}
