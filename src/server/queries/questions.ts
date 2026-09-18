import "server-only";

import { db } from "@/lib/db";
import type { QuestionType } from "@/lib/constants";

export type QuestionConfig = {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  lowLabel?: string;
  highLabel?: string;
  options?: string[];
  multiple?: boolean;
  suggestions?: string[];
  placeholder?: string;
  rows?: number;
};

export type QuestionDTO = {
  id: string;
  key: string;
  prompt: string;
  hint: string | null;
  type: QuestionType;
  scope: "GENERAL" | "GENRE";
  genre: { slug: string; name: string; emoji: string | null } | null;
  config: QuestionConfig;
  sortOrder: number;
};

export type AnswerDTO = {
  questionId: string;
  value: unknown;
  skipped: boolean;
  answeredAt: string;
};

function parseConfig(raw: string): QuestionConfig {
  try {
    return JSON.parse(raw) as QuestionConfig;
  } catch {
    return {};
  }
}

/**
 * Fragen für ein Buch: allgemeine Fragen plus alle Fragen, die zu einem der
 * Genres des Buches gehören. Rein datengetrieben – kein Code pro Genre.
 */
export async function getQuestionsForBook(bookId: string): Promise<QuestionDTO[]> {
  const genres = await db.bookGenre.findMany({
    where: { bookId },
    select: { genreId: true },
  });
  const genreIds = genres.map((g) => g.genreId);

  const questions = await db.question.findMany({
    where: {
      active: true,
      OR: [{ scope: "GENERAL" }, { scope: "GENRE", genreId: { in: genreIds } }],
    },
    include: { genre: { select: { slug: true, name: true, emoji: true } } },
    orderBy: [{ sortOrder: "asc" }],
  });

  return questions.map((q) => ({
    id: q.id,
    key: q.key,
    prompt: q.prompt,
    hint: q.hint,
    type: q.type as QuestionType,
    scope: q.scope as "GENERAL" | "GENRE",
    genre: q.genre,
    config: parseConfig(q.config),
    sortOrder: q.sortOrder,
  }));
}

export async function getAnswers(userBookId: string): Promise<AnswerDTO[]> {
  const rows = await db.questionAnswer.findMany({ where: { userBookId } });
  return rows.map((row) => ({
    questionId: row.questionId,
    value: row.value ? safeParse(row.value) : null,
    skipped: row.skipped,
    answeredAt: row.answeredAt.toISOString(),
  }));
}

/** Beantwortete Fragen inklusive Fragetext – für die Buchseite. */
export async function getAnsweredQuestions(userBookId: string) {
  const rows = await db.questionAnswer.findMany({
    where: { userBookId, skipped: false, NOT: { value: null } },
    include: { question: { include: { genre: { select: { name: true, emoji: true } } } } },
    orderBy: { question: { sortOrder: "asc" } },
  });

  return rows.map((row) => ({
    id: row.id,
    prompt: row.question.prompt,
    type: row.question.type as QuestionType,
    config: parseConfig(row.question.config),
    genreName: row.question.genre?.name ?? null,
    genreEmoji: row.question.genre?.emoji ?? null,
    value: row.value ? safeParse(row.value) : null,
  }));
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
