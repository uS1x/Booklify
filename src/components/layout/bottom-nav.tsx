"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChartPie, HandHeart, LogOut, Menu, Plus, UserRound } from "lucide-react";

import { MOBILE_PRIMARY, isActive } from "@/components/layout/nav-items";
import { Modal } from "@/components/ui/modal";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

const MORE_ITEMS = [
  { href: "/loans", label: "Ausleihen", icon: HandHeart },
  { href: "/stats", label: "Statistiken", icon: ChartPie },
  { href: "/notifications", label: "Benachrichtigungen", icon: Bell },
  { href: "/profile", label: "Profil & Einstellungen", icon: UserRound },
];

export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden dark:border-white/8 dark:bg-paper/92"
        aria-label="Hauptnavigation"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
          {MOBILE_PRIMARY.slice(0, 2).map((item) => (
            <NavButton key={item.href} href={item.href} label={item.label} active={isActive(pathname, item)}>
              <item.icon size={21} />
            </NavButton>
          ))}

          <div className="flex justify-center">
            <Link
              href="/books/new"
              aria-label="Buch hinzufügen"
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-ink text-paper shadow-lift transition-transform active:scale-95 dark:bg-clay-400 dark:text-ink"
            >
              <Plus size={24} />
            </Link>
          </div>

          {MOBILE_PRIMARY.slice(2).map((item) => (
            <NavButton key={item.href} href={item.href} label={item.label} active={isActive(pathname, item)}>
              <item.icon size={21} />
            </NavButton>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] transition-colors",
              MORE_ITEMS.some((i) => pathname.startsWith(i.href)) ? "text-clay-500" : "text-ink-faint",
            )}
          >
            <Menu size={21} />
            Mehr
            {unread > 0 ? (
              <span className="absolute top-0.5 right-2 size-2 rounded-full bg-clay-500 ring-2 ring-paper" />
            ) : null}
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mehr">
        <div className="flex flex-col gap-1 pb-2">
          {MORE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink transition-colors hover:bg-ink/5 dark:hover:bg-white/8"
            >
              <item.icon size={19} className="text-ink-soft" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/notifications" && unread > 0 ? (
                <span className="rounded-full bg-clay-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {unread}
                </span>
              ) : null}
            </Link>
          ))}
          <form action={logoutAction} className="mt-2 border-t border-ink/8 pt-2 dark:border-white/8">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink-soft transition-colors hover:bg-ink/5 dark:hover:bg-white/8"
            >
              <LogOut size={19} />
              Abmelden
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}

function NavButton({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] transition-colors",
        active ? "text-clay-500 dark:text-clay-300" : "text-ink-faint hover:text-ink-soft",
      )}
    >
      {children}
      {label}
    </Link>
  );
}
