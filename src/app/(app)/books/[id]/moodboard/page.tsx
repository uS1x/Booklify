import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDrawings, getMoodboard } from "@/server/queries/moodboard";
import { activeImageProvider } from "@/lib/providers/images";
import { MoodboardEditor } from "@/components/moodboard/moodboard-editor";

export const metadata: Metadata = { title: "Moodboard" };

export default async function MoodboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tool?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tool } = await searchParams;

  const userBook = await db.userBook.findFirst({
    where: { id, userId: user.id },
    select: { id: true, book: { select: { title: true, author: true } } },
  });
  if (!userBook) notFound();

  const [moodboard, drawings] = await Promise.all([getMoodboard(userBook.id), getDrawings(userBook.id)]);
  const provider = activeImageProvider();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/books/${userBook.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} />
            Zurück zum Buch
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-tight text-ink sm:text-3xl">
            Moodboard
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            {userBook.book.title} · {userBook.book.author}
          </p>
        </div>
      </div>

      <MoodboardEditor
        userBookId={userBook.id}
        bookTitle={userBook.book.title}
        initial={moodboard}
        drawings={drawings}
        imageProvider={{
          id: provider.id,
          label: provider.label,
          configured: provider.configured,
          hint: provider.hint,
        }}
        openDrawing={tool === "draw"}
      />
    </div>
  );
}
