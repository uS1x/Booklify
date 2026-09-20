"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { requireOwnedUserBook } from "@/lib/permissions";
import { slugify } from "@/lib/format";
import { READING_STATUSES, VISIBILITIES } from "@/lib/constants";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : { data: T }))
  | { ok: false; error: string };

function revalidateBook(userBookId?: string) {
  revalidatePath("/");
  revalidatePath("/books");
  revalidatePath("/stats");
  if (userBookId) revalidatePath(`/books/${userBookId}`);
}

/* ────────────────────────────────────────── Anlegen */

const bookInputSchema = z.object({
  title: z.string().min(1, "Titel fehlt").max(300),
  subtitle: z.string().max(300).optional().nullable(),
  author: z.string().min(1, "Autor fehlt").max(200),
  coverUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  description: z.string().max(8000).optional().nullable(),
  isbn10: z.string().max(20).optional().nullable(),
  isbn13: z.string().max(20).optional().nullable(),
  publishedYear: z.number().int().min(0).max(2200).optional().nullable(),
  publisher: z.string().max(200).optional().nullable(),
  pageCount: z.number().int().min(1).max(20000).optional().nullable(),
  language: z.string().max(20).optional().nullable(),
  genreSlugs: z.array(z.string()).max(6).default([]),
  externalSource: z.string().max(40).optional().nullable(),
  externalId: z.string().max(120).optional().nullable(),
});

/**
 * Cover-Quelle: entweder eine externe URL oder ein eigener Upload unter
 * /api/media/<id>. Eigene Uploads sind zugriffsgeschützt und gehören deshalb
 * an das Exemplar (coverOverride), nicht an das gemeinsame Werk.
 */
const coverSourceSchema = z
  .string()
  .max(2000)
  .refine(
    (value) => /^https?:\/\//.test(value) || /^\/api\/media\/[A-Za-z0-9_-]+$/.test(value),
    "Ungültige Cover-Adresse",
  );

const copyInputSchema = z.object({
  status: z.enum(READING_STATUSES).default("WANT_TO_READ"),
  currentPage: z.number().int().min(0).max(20000).default(0),
  rating: z.number().int().min(1).max(10).optional().nullable(),
  notes: z.string().max(8000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  visibility: z.enum(VISIBILITIES).default("PRIVATE"),
  lendingEnabled: z.boolean().default(false),
  favorite: z.boolean().default(false),
  coverOverride: coverSourceSchema.optional().nullable().or(z.literal("")),
  startedAt: z.string().optional().nullable(),
  finishedAt: z.string().optional().nullable(),
  readingMinutes: z.number().int().min(0).max(100000).optional().nullable(),
});

export type BookInput = z.input<typeof bookInputSchema>;
export type CopyInput = z.input<typeof copyInputSchema>;

const toDate = (value?: string | null) => (value ? new Date(value) : null);

async function connectGenres(bookId: string, slugs: string[]) {
  const genres = await db.genre.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  await db.bookGenre.deleteMany({ where: { bookId } });
  if (genres.length) {
    await db.bookGenre.createMany({ data: genres.map((g) => ({ bookId, genreId: g.id })) });
  }
}

async function syncTags(userId: string, userBookId: string, tagNames: string[]) {
  const clean = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  await db.bookTag.deleteMany({ where: { userBookId } });
  for (const name of clean) {
    const slug = slugify(name) || name.toLowerCase();
    const tag = await db.tag.upsert({
      where: { userId_slug: { userId, slug } },
      create: { userId, slug, name },
      update: { name },
    });
    await db.bookTag.create({ data: { userBookId, tagId: tag.id } });
  }
}

/**
 * Legt (falls nötig) das Werk an und immer ein eigenes Exemplar dazu.
 * Ein Werk wird über externalSource+externalId bzw. ISBN-13 wiederverwendet,
 * damit mehrere Benutzer dasselbe Buch besitzen können.
 */
export async function createBookAction(
  input: { book: BookInput; copy: CopyInput },
): Promise<ActionResult<{ userBookId: string }>> {
  try {
    const user = await requireUserStrict();
    const book = bookInputSchema.parse(input.book);
    const copy = copyInputSchema.parse(input.copy);

    let existing =
      book.externalSource && book.externalId
        ? await db.book.findFirst({
            where: { externalSource: book.externalSource, externalId: book.externalId },
          })
        : null;
    if (!existing && book.isbn13) existing = await db.book.findFirst({ where: { isbn13: book.isbn13 } });
    if (!existing) {
      existing = await db.book.findFirst({
        where: { title: book.title, author: book.author },
      });
    }

    const data = {
      title: book.title,
      subtitle: book.subtitle || null,
      author: book.author,
      coverUrl: book.coverUrl || null,
      description: book.description || null,
      isbn10: book.isbn10 || null,
      isbn13: book.isbn13 || null,
      publishedYear: book.publishedYear ?? null,
      publishedDate: book.publishedYear ? String(book.publishedYear) : null,
      publisher: book.publisher || null,
      pageCount: book.pageCount ?? null,
      language: book.language || null,
      externalSource: book.externalSource || "manual",
      externalId: book.externalId || null,
    };

    const record = existing
      ? await db.book.update({
          where: { id: existing.id },
          // Vorhandene Werte nur ergänzen, nicht überschreiben.
          data: {
            coverUrl: existing.coverUrl ?? data.coverUrl,
            description: existing.description ?? data.description,
            pageCount: existing.pageCount ?? data.pageCount,
            publisher: existing.publisher ?? data.publisher,
            isbn13: existing.isbn13 ?? data.isbn13,
          },
        })
      : await db.book.create({ data });

    if (!existing) await connectGenres(record.id, book.genreSlugs);

    const duplicate = await db.userBook.findUnique({
      where: { userId_bookId: { userId: user.id, bookId: record.id } },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false, error: "Dieses Buch steht schon in deinem Regal." };
    }

    const finished = copy.status === "READ";
    const userBook = await db.userBook.create({
      data: {
        userId: user.id,
        bookId: record.id,
        status: copy.status,
        currentPage: finished ? (record.pageCount ?? copy.currentPage) : copy.currentPage,
        rating: copy.rating ?? null,
        notes: copy.notes || null,
        visibility: copy.visibility,
        lendingEnabled: copy.lendingEnabled,
        favorite: copy.favorite,
        coverOverride: copy.coverOverride || null,
        startedAt: toDate(copy.startedAt) ?? (copy.status === "READING" ? new Date() : null),
        finishedAt: toDate(copy.finishedAt) ?? (finished ? new Date() : null),
        readingMinutes: copy.readingMinutes ?? null,
        lastReadAt: copy.status === "READING" || finished ? new Date() : null,
      },
    });

    if (copy.tags.length) await syncTags(user.id, userBook.id, copy.tags);
    if (copy.currentPage > 0) {
      await db.readingProgress.create({
        data: { userBookId: userBook.id, page: copy.currentPage, pagesRead: copy.currentPage },
      });
    }

    revalidateBook(userBook.id);
    return { ok: true, data: { userBookId: userBook.id } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/* ────────────────────────────────────────── Bearbeiten */

export async function updateBookAction(
  userBookId: string,
  input: { book: BookInput; copy: Partial<CopyInput> },
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const owned = await requireOwnedUserBook(user.id, userBookId);
    const book = bookInputSchema.parse(input.book);

    await db.book.update({
      where: { id: owned.bookId },
      data: {
        title: book.title,
        subtitle: book.subtitle || null,
        author: book.author,
        coverUrl: book.coverUrl || null,
        description: book.description || null,
        isbn10: book.isbn10 || null,
        isbn13: book.isbn13 || null,
        publishedYear: book.publishedYear ?? null,
        publisher: book.publisher || null,
        pageCount: book.pageCount ?? null,
        language: book.language || null,
      },
    });
    await connectGenres(owned.bookId, book.genreSlugs);

    const copy = input.copy ?? {};
    await db.userBook.update({
      where: { id: userBookId },
      data: {
        ...(copy.status ? { status: copy.status } : {}),
        ...(copy.rating !== undefined ? { rating: copy.rating ?? null } : {}),
        ...(copy.notes !== undefined ? { notes: copy.notes || null } : {}),
        ...(copy.visibility ? { visibility: copy.visibility } : {}),
        ...(copy.lendingEnabled !== undefined ? { lendingEnabled: copy.lendingEnabled } : {}),
        ...(copy.favorite !== undefined ? { favorite: copy.favorite } : {}),
        ...(copy.coverOverride !== undefined ? { coverOverride: copy.coverOverride || null } : {}),
        ...(copy.currentPage !== undefined ? { currentPage: copy.currentPage } : {}),
        ...(copy.startedAt !== undefined ? { startedAt: toDate(copy.startedAt) } : {}),
        ...(copy.finishedAt !== undefined ? { finishedAt: toDate(copy.finishedAt) } : {}),
        ...(copy.readingMinutes !== undefined ? { readingMinutes: copy.readingMinutes ?? null } : {}),
      },
    });

    if (copy.tags) await syncTags(user.id, userBookId, copy.tags);

    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function deleteUserBookAction(userBookId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    const active = await db.loan.findFirst({
      where: { userBookId, status: { in: ["ACTIVE", "RETURN_REQUESTED"] } },
      select: { id: true },
    });
    if (active) return { ok: false, error: "Das Buch ist gerade verliehen – bitte erst die Rückgabe bestätigen." };

    await db.userBook.delete({ where: { id: userBookId } });
    revalidateBook();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/* ────────────────────────────────────────── Status, Fortschritt & Co. */

export async function setStatusAction(
  userBookId: string,
  status: (typeof READING_STATUSES)[number],
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const owned = await requireOwnedUserBook(user.id, userBookId);
    const current = await db.userBook.findUniqueOrThrow({
      where: { id: owned.id },
      select: { startedAt: true, currentPage: true, book: { select: { pageCount: true } } },
    });

    const now = new Date();
    const pageCount = current.book.pageCount ?? 0;

    await db.userBook.update({
      where: { id: userBookId },
      data: {
        status,
        startedAt: status === "READING" && !current.startedAt ? now : current.startedAt,
        finishedAt: status === "READ" ? now : null,
        currentPage: status === "READ" && pageCount ? pageCount : current.currentPage,
        lastReadAt: status === "WANT_TO_READ" ? null : now,
      },
    });

    if (status === "READ" && pageCount) {
      await db.readingProgress.create({
        data: {
          userBookId,
          page: pageCount,
          pagesRead: Math.max(0, pageCount - current.currentPage),
          note: "Fertig gelesen",
        },
      });
    }

    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function updateProgressAction(
  userBookId: string,
  page: number,
  note?: string,
): Promise<ActionResult<{ status: string; page: number }>> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    const current = await db.userBook.findUniqueOrThrow({
      where: { id: userBookId },
      select: { currentPage: true, status: true, startedAt: true, book: { select: { pageCount: true } } },
    });

    const pageCount = current.book.pageCount ?? 0;
    const nextPage = Math.max(0, Math.min(pageCount || 99999, Math.round(page)));
    const completed = pageCount > 0 && nextPage >= pageCount;
    const now = new Date();

    await db.userBook.update({
      where: { id: userBookId },
      data: {
        currentPage: nextPage,
        lastReadAt: now,
        status: completed ? "READ" : current.status === "WANT_TO_READ" ? "READING" : current.status,
        startedAt: current.startedAt ?? now,
        finishedAt: completed ? now : null,
      },
    });

    await db.readingProgress.create({
      data: {
        userBookId,
        page: nextPage,
        pagesRead: Math.max(0, nextPage - current.currentPage),
        note: note?.slice(0, 500) || null,
      },
    });

    revalidateBook(userBookId);
    return { ok: true, data: { status: completed ? "READ" : "READING", page: nextPage } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function setRatingAction(userBookId: string, rating: number | null): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    const value = rating === null ? null : Math.max(1, Math.min(10, Math.round(rating)));
    await db.userBook.update({ where: { id: userBookId }, data: { rating: value } });
    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function saveNotesAction(userBookId: string, notes: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    await db.userBook.update({
      where: { id: userBookId },
      data: { notes: notes.slice(0, 8000) || null },
    });
    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function setTagsAction(userBookId: string, tags: string[]): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    await syncTags(user.id, userBookId, tags);
    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function toggleFavoriteAction(userBookId: string): Promise<ActionResult<{ favorite: boolean }>> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    const current = await db.userBook.findUniqueOrThrow({
      where: { id: userBookId },
      select: { favorite: true },
    });
    const updated = await db.userBook.update({
      where: { id: userBookId },
      data: { favorite: !current.favorite },
      select: { favorite: true },
    });
    revalidateBook(userBookId);
    return { ok: true, data: { favorite: updated.favorite } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Sichtbarkeit und Ausleiherlaubnis – die beiden Datenschutz-Schalter. */
export async function setSharingAction(
  userBookId: string,
  input: { visibility?: "PRIVATE" | "FRIENDS"; lendingEnabled?: boolean },
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);

    // Private Bücher können nicht gleichzeitig verleihbar sein.
    const lending =
      input.visibility === "PRIVATE" ? false : input.lendingEnabled;

    await db.userBook.update({
      where: { id: userBookId },
      data: {
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(lending !== undefined ? { lendingEnabled: lending } : {}),
      },
    });
    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function setReadingDatesAction(
  userBookId: string,
  input: { startedAt?: string | null; finishedAt?: string | null; readingMinutes?: number | null },
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    await db.userBook.update({
      where: { id: userBookId },
      data: {
        startedAt: toDate(input.startedAt ?? null),
        finishedAt: toDate(input.finishedAt ?? null),
        readingMinutes: input.readingMinutes ?? null,
      },
    });
    revalidateBook(userBookId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function message(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Ungültige Eingabe.";
  const text = error instanceof Error ? error.message : String(error);
  if (text === "UNAUTHORIZED") return "Bitte melde dich an.";
  if (text === "NOT_FOUND") return "Dieses Buch gehört nicht zu deinem Regal.";
  console.error("[books]", error);
  return "Das hat nicht funktioniert. Bitte versuche es erneut.";
}
