"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { requireOwnedUserBook } from "@/lib/permissions";
import type { ActionResult } from "@/server/actions/books";

export type AnswerPayload = {
  questionId: string;
  value: unknown;
  skipped: boolean;
};

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/**
 * Speichert die Antworten eines Fragebogens. Übersprungene oder leere
 * Antworten werden als „skipped“ vermerkt – jede Frage bleibt optional.
 */
export async function saveAnswersAction(
  userBookId: string,
  answers: AnswerPayload[],
): Promise<ActionResult<{ saved: number }>> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);

    let saved = 0;
    for (const answer of answers.slice(0, 200)) {
      const question = await db.question.findUnique({
        where: { id: answer.questionId },
        select: { id: true },
      });
      if (!question) continue;

      const skipped = answer.skipped || isEmpty(answer.value);
      const value = skipped ? null : JSON.stringify(answer.value);

      await db.questionAnswer.upsert({
        where: { userBookId_questionId: { userBookId, questionId: answer.questionId } },
        create: { userBookId, questionId: answer.questionId, value, skipped },
        update: { value, skipped, answeredAt: new Date() },
      });
      if (!skipped) saved++;
    }

    // Gesamtbewertung aus der Frage „overall“ in die Buchbewertung übernehmen.
    const overall = await db.questionAnswer.findFirst({
      where: { userBookId, question: { key: "overall" }, skipped: false },
      select: { value: true },
    });
    if (overall?.value) {
      const parsed = Number(JSON.parse(overall.value));
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 10) {
        await db.userBook.update({ where: { id: userBookId }, data: { rating: Math.round(parsed) } });
      }
    }

    revalidatePath(`/books/${userBookId}`);
    revalidatePath("/books");
    revalidatePath("/stats");
    revalidatePath("/");
    return { ok: true, data: { saved } };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (text === "UNAUTHORIZED") return { ok: false, error: "Bitte melde dich an." };
    if (text === "NOT_FOUND") return { ok: false, error: "Dieses Buch gehört nicht zu deinem Regal." };
    console.error("[answers]", error);
    return { ok: false, error: "Die Antworten konnten nicht gespeichert werden." };
  }
}

export async function resetAnswersAction(userBookId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    await db.questionAnswer.deleteMany({ where: { userBookId } });
    revalidatePath(`/books/${userBookId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Das hat nicht funktioniert." };
  }
}
