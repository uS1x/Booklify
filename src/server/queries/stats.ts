import "server-only";

import { db } from "@/lib/db";
import { progressPercent } from "@/lib/format";

export type DashboardStats = {
  totalBooks: number;
  reading: number;
  wantToRead: number;
  finished: number;
  abandoned: number;
  pagesRead: number;
  averageRating: number | null;
  favoriteGenre: { name: string; emoji: string | null; count: number } | null;
  lastRead: { id: string; title: string; author: string; coverUrl: string | null; when: string } | null;
  lentOut: number;
  borrowed: number;
};

/** Kompakte Kennzahlen für das Dashboard neben dem Regal. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [byStatus, ratingAgg, finishedBooks, activeBooks, genreRows, last, lentOut, borrowed] =
    await Promise.all([
      db.userBook.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
      db.userBook.aggregate({ where: { userId, rating: { not: null } }, _avg: { rating: true } }),
      db.userBook.findMany({
        where: { userId, status: "READ" },
        select: { book: { select: { pageCount: true } } },
      }),
      db.userBook.findMany({
        where: { userId, status: { in: ["READING", "ABANDONED"] } },
        select: { currentPage: true },
      }),
      db.bookGenre.findMany({
        where: { book: { userBooks: { some: { userId } } } },
        select: { genre: { select: { name: true, emoji: true } } },
      }),
      db.userBook.findFirst({
        where: { userId, OR: [{ lastReadAt: { not: null } }, { finishedAt: { not: null } }] },
        orderBy: [{ lastReadAt: "desc" }, { finishedAt: "desc" }],
        select: {
          id: true,
          lastReadAt: true,
          finishedAt: true,
          coverOverride: true,
          book: { select: { title: true, author: true, coverUrl: true } },
        },
      }),
      db.loan.count({ where: { lenderId: userId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } } }),
      db.loan.count({ where: { borrowerId: userId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } } }),
    ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));

  const genreTally = new Map<string, { name: string; emoji: string | null; count: number }>();
  for (const row of genreRows) {
    const key = row.genre.name;
    const current = genreTally.get(key) ?? { name: key, emoji: row.genre.emoji, count: 0 };
    current.count++;
    genreTally.set(key, current);
  }
  const favoriteGenre = [...genreTally.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  const pagesRead =
    finishedBooks.reduce((sum, b) => sum + (b.book.pageCount ?? 0), 0) +
    activeBooks.reduce((sum, b) => sum + b.currentPage, 0);

  return {
    totalBooks: byStatus.reduce((sum, s) => sum + s._count._all, 0),
    reading: counts.READING ?? 0,
    wantToRead: counts.WANT_TO_READ ?? 0,
    finished: counts.READ ?? 0,
    abandoned: counts.ABANDONED ?? 0,
    pagesRead,
    averageRating: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(1)) : null,
    favoriteGenre,
    lastRead: last
      ? {
          id: last.id,
          title: last.book.title,
          author: last.book.author,
          coverUrl: last.coverOverride ?? last.book.coverUrl,
          when: (last.lastReadAt ?? last.finishedAt ?? new Date()).toISOString(),
        }
      : null,
    lentOut,
    borrowed,
  };
}

/* ────────────────────────────────────────── Ausführliche Statistik */

export type MonthBucket = { key: string; label: string; books: number; pages: number };
export type YearBucket = { year: number; books: number; pages: number };
export type GenreBucket = { name: string; emoji: string | null; books: number };

export type ReadingStats = {
  booksRead: number;
  pagesRead: number;
  averageRating: number | null;
  averageReadingDays: number | null;
  averageReadingMinutes: number | null;
  longestBook: { title: string; pages: number } | null;
  months: MonthBucket[];
  years: YearBucket[];
  genres: GenreBucket[];
  currentlyReading: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    currentPage: number;
    pageCount: number | null;
    progress: number;
  }[];
  statusCounts: Record<string, number>;
  lentOut: number;
  borrowed: number;
  loansTotal: number;
  booksThisYear: number;
  pagesThisMonth: number;
};

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Alle Werte werden aus den gespeicherten Daten berechnet – nichts ist fest verdrahtet. */
export async function getReadingStats(userId: string): Promise<ReadingStats> {
  const [finished, reading, byStatus, ratingAgg, genreRows, lentOut, borrowed, loansTotal] =
    await Promise.all([
      db.userBook.findMany({
        where: { userId, status: "READ" },
        select: {
          startedAt: true,
          finishedAt: true,
          addedAt: true,
          readingMinutes: true,
          book: { select: { title: true, pageCount: true } },
        },
      }),
      db.userBook.findMany({
        where: { userId, status: "READING" },
        orderBy: { lastReadAt: "desc" },
        select: {
          id: true,
          currentPage: true,
          coverOverride: true,
          book: { select: { title: true, author: true, coverUrl: true, pageCount: true } },
        },
      }),
      db.userBook.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
      db.userBook.aggregate({ where: { userId, rating: { not: null } }, _avg: { rating: true } }),
      db.bookGenre.findMany({
        where: { book: { userBooks: { some: { userId, status: "READ" } } } },
        select: { genre: { select: { name: true, emoji: true } } },
      }),
      db.loan.count({ where: { lenderId: userId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } } }),
      db.loan.count({ where: { borrowerId: userId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } } }),
      db.loan.count({ where: { OR: [{ lenderId: userId }, { borrowerId: userId }] } }),
    ]);

  // Monatsraster der letzten 12 Monate
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[date.getMonth()],
      books: 0,
      pages: 0,
    });
  }
  const monthIndex = new Map(months.map((month, index) => [month.key, index]));

  const yearMap = new Map<number, YearBucket>();
  let pagesRead = 0;
  let durationSum = 0;
  let durationCount = 0;
  let minutesSum = 0;
  let minutesCount = 0;
  let longest: { title: string; pages: number } | null = null;

  for (const entry of finished) {
    const pages = entry.book.pageCount ?? 0;
    pagesRead += pages;
    if (pages && (!longest || pages > longest.pages)) {
      longest = { title: entry.book.title, pages };
    }

    if (entry.startedAt && entry.finishedAt) {
      const days = Math.max(
        1,
        Math.round((entry.finishedAt.getTime() - entry.startedAt.getTime()) / 86400000),
      );
      durationSum += days;
      durationCount++;
    }
    if (entry.readingMinutes) {
      minutesSum += entry.readingMinutes;
      minutesCount++;
    }

    const when = entry.finishedAt ?? entry.addedAt;
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
    const index = monthIndex.get(key);
    if (index !== undefined) {
      months[index].books++;
      months[index].pages += pages;
    }

    const year = when.getFullYear();
    const bucket = yearMap.get(year) ?? { year, books: 0, pages: 0 };
    bucket.books++;
    bucket.pages += pages;
    yearMap.set(year, bucket);
  }

  const activeReading = reading.map((entry) => ({
    id: entry.id,
    title: entry.book.title,
    author: entry.book.author,
    coverUrl: entry.coverOverride ?? entry.book.coverUrl,
    currentPage: entry.currentPage,
    pageCount: entry.book.pageCount,
    progress: progressPercent(entry.currentPage, entry.book.pageCount),
  }));

  pagesRead += reading.reduce((sum, entry) => sum + entry.currentPage, 0);

  const genreTally = new Map<string, GenreBucket>();
  for (const row of genreRows) {
    const current = genreTally.get(row.genre.name) ?? {
      name: row.genre.name,
      emoji: row.genre.emoji,
      books: 0,
    };
    current.books++;
    genreTally.set(row.genre.name, current);
  }

  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return {
    booksRead: finished.length,
    pagesRead,
    averageRating: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(1)) : null,
    averageReadingDays: durationCount ? Math.round(durationSum / durationCount) : null,
    averageReadingMinutes: minutesCount ? Math.round(minutesSum / minutesCount) : null,
    longestBook: longest,
    months,
    years: [...yearMap.values()].sort((a, b) => a.year - b.year).slice(-6),
    genres: [...genreTally.values()].sort((a, b) => b.books - a.books).slice(0, 8),
    currentlyReading: activeReading,
    statusCounts: Object.fromEntries(byStatus.map((entry) => [entry.status, entry._count._all])),
    lentOut,
    borrowed,
    loansTotal,
    booksThisYear: yearMap.get(now.getFullYear())?.books ?? 0,
    pagesThisMonth: months.find((month) => month.key === thisMonthKey)?.pages ?? 0,
  };
}
