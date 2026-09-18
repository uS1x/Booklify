import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAnswers, getQuestionsForBook } from "@/server/queries/questions";
import { QuestionnaireForm } from "@/components/questions/questionnaire-form";
import { BookCover } from "@/components/ui/book-cover";

export const metadata: Metadata = { title: "Fragebogen" };

export default async function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const userBook = await db.userBook.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      bookId: true,
      coverOverride: true,
      book: { select: { title: true, author: true, coverUrl: true } },
    },
  });
  if (!userBook) notFound();

  const [questions, answers] = await Promise.all([
    getQuestionsForBook(userBook.bookId),
    getAnswers(userBook.id),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href={`/books/${userBook.id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        Zurück zum Buch
      </Link>

      <header className="flex items-center gap-4">
        <div className="h-24 w-16 shrink-0 shadow-book">
          <BookCover
            title={userBook.book.title}
            author={userBook.book.author}
            coverUrl={userBook.coverOverride ?? userBook.book.coverUrl}
            textScale={0.55}
          />
        </div>
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight text-ink sm:text-3xl">
            Dein Fragebogen
          </h1>
          <p className="mt-1 truncate text-sm text-ink-faint">
            {userBook.book.title} · {userBook.book.author}
          </p>
        </div>
      </header>

      <QuestionnaireForm
        userBookId={userBook.id}
        bookTitle={userBook.book.title}
        questions={questions}
        existing={answers}
      />
    </div>
  );
}
