"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, LogOut } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { NAV_ITEMS, isActive } from "@/components/layout/nav-items";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/auth";

export function Sidebar({ user, unread }: { user: SessionUser; unread: number }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink/8 bg-surface/70 px-4 py-6 backdrop-blur-xl lg:flex dark:border-white/8 dark:bg-surface/50">
      <Brand className="px-2" />

      <Link
        href="/books/new"
        className="mt-7 flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-paper shadow-soft transition-all hover:bg-clay-600 hover:shadow-lift dark:bg-clay-400 dark:text-ink dark:hover:bg-clay-300"
      >
        <Plus size={17} />
        Buch hinzufügen
      </Link>

      <nav className="mt-7 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-paper-deep/70 font-medium text-ink dark:bg-white/10"
                  : "text-ink-soft hover:bg-ink/4 hover:text-ink dark:hover:bg-white/6",
              )}
            >
              <Icon size={18} className={active ? "text-clay-500 dark:text-clay-300" : ""} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/notifications" && unread > 0 ? (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-clay-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-ink/8 bg-surface p-3 dark:border-white/8">
        <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={user.displayName} accentColor={user.accentColor} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{user.displayName}</span>
            <span className="block truncate text-xs text-ink-faint">@{user.username}</span>
          </span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Abmelden"
            aria-label="Abmelden"
            className="flex size-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}
