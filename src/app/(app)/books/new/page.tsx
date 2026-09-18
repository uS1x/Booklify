import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { activeProvider } from "@/lib/providers/books";
import { AddBookWizard } from "@/components/books/add-book-wizard";

export const metadata: Metadata = { title: "Buch hinzufügen" };

export default async function NewBookPage() {
  await requireUser();

  const [genres, provider] = await Promise.all([
    db.genre.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } }),
    Promise.resolve(activeProvider()),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          href="/books"
          className="inline-flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Zur Bibliothek
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight text-ink">
          Buch hinzufügen
        </h1>
        <p className="mt-1.5 text-sm text-ink-faint">
          Suche nach Titel, Autor oder ISBN – oder leg das Buch komplett von Hand an.
        </p>
      </div>

      <AddBookWizard genres={genres} provider={provider} />
    </div>
  );
}
