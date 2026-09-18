import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, HandHeart, Lock } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFriendShelf } from "@/server/queries/friends";
import { getUserBooks } from "@/server/queries/books";
import { LibraryView } from "@/components/books/library-view";
import type { FriendBookContext } from "@/components/books/book-quick-look";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { pluralize } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `Regal von @${username}` };
}

export default async function FriendShelfPage({ params }: { params: Promise<{ username: string }> }) {
  const user = await requireUser();
  const { username } = await params;

  const result = await getFriendShelf(user.id, username);
  if (!result) notFound();
  const { owner, access } = result;

  if (owner.id === user.id) {
    // Eigenes Regal – direkt auf die Startseite.
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-faint">Das ist dein eigenes Regal.</p>
        <Link href="/" className="text-clay-600 underline-offset-2 hover:underline dark:text-clay-300">
          Zum eigenen Bücherregal
        </Link>
      </div>
    );
  }

  // Zugriff verweigert: bewusst keine Buchdaten laden.
  if (access === "NONE") {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/friends"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Zu den Freunden
        </Link>
        <EmptyState
          icon={<Lock size={22} />}
          title={`${owner.displayName} teilt das Regal (noch) nicht`}
          description="Private Regale bleiben privat. Sobald dein Freund dich freischaltet, erscheinen hier die geteilten Bücher."
        />
      </div>
    );
  }

  const books = await getUserBooks(owner.id, {}, { visibility: "FRIENDS" });

  // Kontext pro Buch: Habe ich es selbst? Läuft schon eine Anfrage?
  const [myBooks, myRequests] = await Promise.all([
    db.userBook.findMany({
      where: { userId: user.id, bookId: { in: books.map((book) => book.bookId) } },
      select: { bookId: true },
    }),
    db.loanRequest.findMany({
      where: { requesterId: user.id, status: "PENDING", userBookId: { in: books.map((book) => book.id) } },
      select: { userBookId: true },
    }),
  ]);

  const ownedBookIds = new Set(myBooks.map((entry) => entry.bookId));
  const pendingIds = new Set(myRequests.map((entry) => entry.userBookId));

  const contexts: Record<string, FriendBookContext> = Object.fromEntries(
    books.map((book) => [
      book.id,
      {
        alreadyOwned: ownedBookIds.has(book.bookId),
        pendingRequest: pendingIds.has(book.id),
        canRequest:
          access === "REQUEST_LOAN" && book.lendingEnabled && book.loanState === "AVAILABLE",
      },
    ]),
  );

  const lendable = books.filter((book) => book.lendingEnabled).length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/friends"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        Zu den Freunden
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-ink/8 bg-surface p-5 shadow-soft dark:border-white/8">
        <Avatar name={owner.displayName} accentColor={owner.accentColor} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight text-ink sm:text-3xl">
            {owner.shelf?.name ?? `Regal von ${owner.displayName}`}
          </h1>
          <p className="mt-1 text-sm text-ink-faint">
            {owner.displayName} · @{owner.username}
            {owner.bio ? ` · ${owner.bio}` : ""}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone="bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200">
              {access === "REQUEST_LOAN" ? <HandHeart size={11} /> : <Eye size={11} />}
              {access === "REQUEST_LOAN" ? "Ausleihe anfragen erlaubt" : "Nur ansehen"}
            </Badge>
            <Badge>{pluralize(books.length, "geteiltes Buch", "geteilte Bücher")}</Badge>
            {access === "REQUEST_LOAN" ? (
              <Badge>{pluralize(lendable, "Buch ausleihbar", "Bücher ausleihbar")}</Badge>
            ) : null}
          </div>
        </div>
      </header>

      <LibraryView
        books={books}
        owner={false}
        friendContexts={contexts}
        storageKey="regal-view-friend"
        shelfLabel={`${books.length} Bücher`}
        header={
          <div>
            <h2 className="text-xl text-ink">Geteilte Bücher</h2>
            <p className="text-sm text-ink-faint">
              Klicke ein Buch an – bei ausleihbaren Büchern kannst du direkt anfragen.
            </p>
          </div>
        }
        emptyState={
          <EmptyState
            icon={<Lock size={22} />}
            title="Noch keine geteilten Bücher"
            description={`${owner.displayName} hat bisher kein Buch für Freunde freigegeben.`}
          />
        }
      />
    </div>
  );
}
