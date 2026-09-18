import Link from "next/link";
import { cn } from "@/lib/cn";

/** Wortmarke mit kleinem Buchrücken-Logo. */
export function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-8 items-end justify-center gap-[2px] rounded-md bg-gradient-to-br from-clay-400 to-clay-600 p-1 shadow-soft transition-transform duration-300 group-hover:-rotate-3">
        <span className="h-4 w-1.5 rounded-sm bg-honey-200/90" />
        <span className="h-6 w-1.5 rounded-sm bg-paper/90" />
        <span className="h-3 w-1.5 rounded-sm bg-sage-200/90" />
      </span>
      {!compact ? (
        <span className="font-[family-name:var(--font-display)] text-lg leading-none tracking-tight text-ink">
          Bücherregal
        </span>
      ) : null}
    </Link>
  );
}
