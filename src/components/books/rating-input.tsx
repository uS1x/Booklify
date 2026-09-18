"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { setRatingAction } from "@/server/actions/books";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

/** Persönliche Bewertung von 1 bis 10 – speichert sofort. */
export function RatingInput({
  userBookId,
  rating,
  className,
}: {
  userBookId: string;
  rating: number | null;
  className?: string;
}) {
  const [value, setValue] = useState(rating);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const save = (next: number | null) => {
    setValue(next);
    startTransition(async () => {
      const result = await setRatingAction(userBookId, next);
      if (result.ok) router.refresh();
      else toast(result.error, "error");
    });
  };

  const shown = hover ?? value ?? 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            aria-label={`${n} von 10`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => save(value === n ? null : n)}
            className={cn(
              "group flex h-8 w-5 items-end justify-center rounded-sm transition-all sm:w-6",
              n <= shown ? "text-honey-400" : "text-ink/15 dark:text-white/20",
            )}
          >
            <span
              className={cn(
                "w-full rounded-t-sm bg-current transition-all",
                n <= shown ? "opacity-100" : "opacity-60",
              )}
              style={{ height: `${28 + n * 2.6}%` }}
            />
          </button>
        ))}
      </div>

      <span className="flex items-center gap-1 text-sm">
        {value ? (
          <>
            <Star size={14} className="text-honey-400" fill="currentColor" />
            <span className="font-semibold text-ink tabular-nums">{value}</span>
            <span className="text-ink-faint">/ 10</span>
          </>
        ) : (
          <span className="text-ink-faint">noch nicht bewertet</span>
        )}
      </span>

      {value ? (
        <button
          type="button"
          onClick={() => save(null)}
          className="text-xs text-ink-faint underline-offset-2 hover:underline"
        >
          zurücksetzen
        </button>
      ) : null}
    </div>
  );
}
