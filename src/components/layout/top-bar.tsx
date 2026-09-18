"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/auth";

export function TopBar({ user, unread }: { user: SessionUser; unread: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-ink/6 bg-paper/80 backdrop-blur-xl dark:border-white/6 dark:bg-paper/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Brand className="lg:hidden" compact />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(query.trim() ? `/books?q=${encodeURIComponent(query.trim())}` : "/books");
          }}
          className="relative ml-auto hidden max-w-md flex-1 sm:ml-0 sm:block"
        >
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel, Autor, Genre oder Tag suchen …"
            aria-label="Bibliothek durchsuchen"
            className="h-10 w-full rounded-full border border-ink/10 bg-surface/80 pr-4 pl-10 text-sm text-ink placeholder:text-ink-faint/80 transition-colors focus:border-clay-300 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-clay-200/40 dark:border-white/10 dark:bg-white/5"
          />
        </form>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/books?focus=1"
            aria-label="Suchen"
            className="flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 sm:hidden dark:hover:bg-white/10"
          >
            <Search size={18} />
          </Link>

          <Link
            href="/notifications"
            aria-label={`Benachrichtigungen${unread ? `, ${unread} ungelesen` : ""}`}
            className={cn(
              "relative flex size-10 items-center justify-center rounded-full transition-colors hover:bg-ink/5 dark:hover:bg-white/10",
              pathname === "/notifications" ? "text-clay-500" : "text-ink-soft hover:text-ink",
            )}
          >
            <Bell size={18} />
            {unread > 0 ? (
              <span className="absolute top-1.5 right-1 flex min-w-4 items-center justify-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-white ring-2 ring-paper dark:ring-paper">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          <ThemeToggle />

          <Link
            href="/books/new"
            className="ml-1 hidden items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-soft transition-all hover:bg-clay-600 hover:shadow-lift lg:inline-flex dark:bg-clay-400 dark:text-ink dark:hover:bg-clay-300"
          >
            <Plus size={16} />
            Buch hinzufügen
          </Link>

          <Link href="/profile" className="ml-1 lg:hidden" aria-label="Profil">
            <Avatar name={user.displayName} accentColor={user.accentColor} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
