import Link from "next/link";
import { BookMarked, BookOpen, FileText, Library, Sparkles, Star } from "lucide-react";

import { formatNumber, formatRelative, truncate } from "@/lib/format";
import type { DashboardStats } from "@/server/queries/stats";
import { cn } from "@/lib/cn";

/** Kompakte Kennzahlen – bewusst keine Statistikseite auf der Startseite. */
export function StatStrip({ stats }: { stats: DashboardStats }) {
  const items = [
    {
      label: "Bücher im Regal",
      value: formatNumber(stats.totalBooks),
      icon: Library,
      tint: "text-clay-500",
      href: "/books",
    },
    {
      label: "Lese ich gerade",
      value: formatNumber(stats.reading),
      icon: BookOpen,
      tint: "text-honey-500",
      href: "/books?status=READING",
    },
    {
      label: "Gelesene Seiten",
      value: formatNumber(stats.pagesRead),
      icon: FileText,
      tint: "text-sage-400",
      href: "/stats",
    },
    {
      label: "Ø Bewertung",
      value: stats.averageRating ? `${stats.averageRating.toString().replace(".", ",")} / 10` : "—",
      icon: Star,
      tint: "text-honey-400",
      href: "/stats",
    },
    {
      label: "Lieblingsgenre",
      value: stats.favoriteGenre ? `${stats.favoriteGenre.emoji ?? ""} ${stats.favoriteGenre.name}` : "—",
      icon: Sparkles,
      tint: "text-plum-400",
      href: "/stats",
    },
    {
      label: "Zuletzt gelesen",
      value: stats.lastRead ? truncate(stats.lastRead.title, 22) : "—",
      hint: stats.lastRead ? formatRelative(stats.lastRead.when) : undefined,
      icon: BookMarked,
      tint: "text-ocean-400",
      href: stats.lastRead ? `/books/${stats.lastRead.id}` : "/books",
    },
  ];

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="group min-w-[9.5rem] flex-1 rounded-2xl border border-ink/8 bg-surface/80 px-4 py-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift dark:border-white/8"
        >
          <span className="flex items-center gap-2 text-[11px] tracking-wide text-ink-faint uppercase">
            <item.icon size={13} className={cn(item.tint)} />
            {item.label}
          </span>
          <span className="mt-1.5 block truncate font-[family-name:var(--font-display)] text-xl text-ink">
            {item.value}
          </span>
          {item.hint ? <span className="block text-[11px] text-ink-faint">{item.hint}</span> : null}
        </Link>
      ))}
    </div>
  );
}
