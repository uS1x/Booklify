import Link from "next/link";
import { BookPlus, Lock, Users } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserBooks } from "@/server/queries/books";
import { getDashboardStats } from "@/server/queries/stats";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { CurrentlyReading } from "@/components/dashboard/currently-reading";
import { LibraryView } from "@/components/books/library-view";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/format";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Noch wach";
  if (hour < 11) return "Guten Morgen";
  if (hour < 14) return "Hallo";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export default async function ShelfPage() {
  const user = await requireUser();

  const [books, stats, shelf, pendingRequests] = await Promise.all([
    getUserBooks(user.id),
    getDashboardStats(user.id),
    db.sharedShelf.findUnique({
      where: { ownerId: user.id },
      select: { name: true, visibility: true, _count: { select: { members: true } } },
    }),
    db.loanRequest.count({ where: { ownerId: user.id, status: "PENDING" } }),
  ]);

  const reading = books.filter((b) => b.status === "READING");
  const shared = shelf?.visibility === "FRIENDS" || (shelf?._count.members ?? 0) > 0;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-faint">
            {greeting()}, {user.displayName}
            {reading.length ? ` – ${pluralize(reading.length, "Buch wartet", "Bücher warten")} auf dich.` : "."}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight text-ink sm:text-4xl">
            {shelf?.name ?? "Mein Bücherregal"}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge
              tone={
                shared
                  ? "bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200"
                  : "bg-paper-deep/70 text-ink-soft dark:bg-white/10"
              }
            >
              {shared ? <Users size={12} /> : <Lock size={12} />}
              {shared ? "Mit Freunden geteilt" : "Privat"}
            </Badge>
            {shelf?._count.members ? (
              <Link href="/profile#sharing" className="text-xs text-ink-faint underline-offset-2 hover:underline">
                {pluralize(shelf._count.members, "Freund freigeschaltet", "Freunde freigeschaltet")}
              </Link>
            ) : null}
            {pendingRequests > 0 ? (
              <Link href="/loans">
                <Badge tone="bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200">
                  {pluralize(pendingRequests, "offene Ausleihanfrage", "offene Ausleihanfragen")}
                </Badge>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="hidden sm:block">
          <ButtonLink href="/books/new" size="lg">
            <BookPlus size={18} />
            Buch hinzufügen
          </ButtonLink>
        </div>
      </header>

      <StatStrip stats={stats} />

      <CurrentlyReading books={reading} />

      <LibraryView
        books={books}
        owner
        shelfLabel={`${books.length} Bücher`}
        header={
          <div>
            <h2 className="text-xl text-ink">Alle Bücher</h2>
            <p className="text-sm text-ink-faint">
              Klicke ein Buch an, um es aufzuschlagen.
            </p>
          </div>
        }
        emptyState={
          <EmptyState
            icon={<BookPlus size={22} />}
            title="Dein Regal ist noch leer"
            description="Such dein erstes Buch über Titel, Autor oder ISBN – oder leg es ganz manuell an."
            action={
              <ButtonLink href="/books/new">
                <BookPlus size={16} />
                Erstes Buch hinzufügen
              </ButtonLink>
            }
          />
        }
      />
    </div>
  );
}
