import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { progressPercent } from "@/lib/format";
import type { LoanState, ReadingStatus, SortOption, Visibility } from "@/lib/constants";

/** Serialisierbares DTO für Client-Komponenten (Regal, Grid, Liste). */
export type ShelfBook = {
  id: string;
  bookId: string;
  title: string;
  subtitle: string | null;
  author: string;
  coverUrl: string | null;
  description: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  publisher: string | null;
  language: string | null;
  isbn: string | null;
  status: ReadingStatus;
  rating: number | null;
  notes: string | null;
  currentPage: number;
  progress: number;
  favorite: boolean;
  visibility: Visibility;
  lendingEnabled: boolean;
  loanState: LoanState;
  addedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastReadAt: string | null;
  genres: { slug: string; name: string; emoji: string | null; tint: string }[];
  tags: string[];
  owner: { id: string; displayName: string; username: string; accentColor: string };
  activeLoan: { borrowerName: string; dueDate: string | null; status: string } | null;
  hasMoodboard: boolean;
  drawingCount: number;
  answerCount: number;
};

const include = {
  book: { include: { genres: { include: { genre: true } } } },
  tags: { include: { tag: true } },
  user: { select: { id: true, displayName: true, username: true, accentColor: true } },
  loans: {
    where: { status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
    select: { status: true, dueDate: true, borrower: { select: { displayName: true } } },
    take: 1,
  },
  moodboard: { select: { id: true } },
  _count: { select: { drawings: true, answers: true } },
} satisfies Prisma.UserBookInclude;

type Row = Prisma.UserBookGetPayload<{ include: typeof include }>;

export function toShelfBook(row: Row): ShelfBook {
  const loan = row.loans[0];
  return {
    id: row.id,
    bookId: row.bookId,
    title: row.book.title,
    subtitle: row.book.subtitle,
    author: row.book.author,
    coverUrl: row.coverOverride ?? row.book.coverUrl,
    description: row.book.description,
    pageCount: row.book.pageCount,
    publishedYear: row.book.publishedYear,
    publisher: row.book.publisher,
    language: row.book.language,
    isbn: row.book.isbn13 ?? row.book.isbn10,
    status: row.status as ReadingStatus,
    rating: row.rating,
    notes: row.notes,
    currentPage: row.currentPage,
    progress: progressPercent(row.currentPage, row.book.pageCount),
    favorite: row.favorite,
    visibility: row.visibility as Visibility,
    lendingEnabled: row.lendingEnabled,
    loanState: row.loanState as LoanState,
    addedAt: row.addedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
    genres: row.book.genres.map((g) => ({
      slug: g.genre.slug,
      name: g.genre.name,
      emoji: g.genre.emoji,
      tint: g.genre.tint,
    })),
    tags: row.tags.map((t) => t.tag.name),
    owner: row.user,
    activeLoan: loan
      ? {
          borrowerName: loan.borrower.displayName,
          dueDate: loan.dueDate?.toISOString() ?? null,
          status: loan.status,
        }
      : null,
    hasMoodboard: Boolean(row.moodboard),
    drawingCount: row._count.drawings,
    answerCount: row._count.answers,
  };
}

export type LibraryFilters = {
  q?: string;
  status?: string;
  genre?: string;
  tag?: string;
  year?: string;
  minRating?: string;
  sort?: SortOption;
};

function orderBy(sort?: SortOption) {
  switch (sort) {
    case "title":
      return [{ book: { title: "asc" } }] as const;
    case "author":
      return [{ book: { author: "asc" } }] as const;
    case "rating":
      return [{ rating: "desc" }, { addedAt: "desc" }] as const;
    case "lastRead":
      return [{ lastReadAt: "desc" }, { addedAt: "desc" }] as const;
    default:
      return [{ addedAt: "desc" }] as const;
  }
}

/**
 * Bücher eines Benutzers laden. `visibilityFilter` wird bei fremden Regalen
 * gesetzt, damit private Exemplare gar nicht erst aus der DB kommen.
 */
export async function getUserBooks(
  userId: string,
  filters: LibraryFilters = {},
  visibilityFilter?: { visibility: "FRIENDS" },
): Promise<ShelfBook[]> {
  const q = filters.q?.trim();
  const rating = filters.minRating ? Number.parseInt(filters.minRating, 10) : undefined;
  const year = filters.year ? Number.parseInt(filters.year, 10) : undefined;

  const rows = await db.userBook.findMany({
    where: {
      userId,
      ...(visibilityFilter ?? {}),
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(rating ? { rating: { gte: rating } } : {}),
      ...(filters.tag ? { tags: { some: { tag: { name: filters.tag } } } } : {}),
      ...(filters.genre ? { book: { genres: { some: { genre: { slug: filters.genre } } } } } : {}),
      ...(year ? { book: { publishedYear: year } } : {}),
      ...(q
        ? {
            OR: [
              { book: { title: { contains: q } } },
              { book: { author: { contains: q } } },
              { book: { publisher: { contains: q } } },
              { notes: { contains: q } },
              { tags: { some: { tag: { name: { contains: q } } } } },
              { book: { genres: { some: { genre: { name: { contains: q } } } } } },
            ],
          }
        : {}),
    },
    include,
    orderBy: [...orderBy(filters.sort)],
  });

  return rows.map(toShelfBook);
}

export async function getUserBookById(userBookId: string): Promise<ShelfBook | null> {
  const row = await db.userBook.findUnique({ where: { id: userBookId }, include });
  return row ? toShelfBook(row) : null;
}

/** Filteroptionen für die Bibliotheksansicht (nur tatsächlich vorhandene Werte). */
export async function getLibraryFacets(userId: string) {
  const [genres, tags, years, statuses] = await Promise.all([
    db.genre.findMany({
      where: { books: { some: { book: { userBooks: { some: { userId } } } } } },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, emoji: true },
    }),
    db.tag.findMany({ where: { userId, books: { some: {} } }, orderBy: { name: "asc" }, select: { name: true } }),
    db.userBook.findMany({
      where: { userId, book: { publishedYear: { not: null } } },
      select: { book: { select: { publishedYear: true } } },
      distinct: ["bookId"],
    }),
    db.userBook.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
  ]);

  return {
    genres,
    tags: tags.map((t) => t.name),
    years: [...new Set(years.map((y) => y.book.publishedYear!).filter(Boolean))].sort((a, b) => b - a),
    statusCounts: Object.fromEntries(statuses.map((s) => [s.status, s._count._all])) as Record<string, number>,
  };
}

/** „3 deiner Freunde besitzen dieses Buch“ – nur bei geteilten Exemplaren. */
export async function getFriendsOwningBook(bookId: string, friendIdList: string[], excludeUserId: string) {
  if (!friendIdList.length) return [];
  const rows = await db.userBook.findMany({
    where: {
      bookId,
      userId: { in: friendIdList.filter((id) => id !== excludeUserId) },
      visibility: "FRIENDS",
    },
    select: {
      id: true,
      lendingEnabled: true,
      loanState: true,
      status: true,
      user: { select: { id: true, displayName: true, username: true, accentColor: true } },
    },
  });
  return rows;
}
