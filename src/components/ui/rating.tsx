import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/** Anzeige einer 1–10-Bewertung als 5 Sterne (halbe Sterne inklusive). */
export function Stars({
  value,
  scale = 10,
  size = 16,
  className,
  showValue,
}: {
  value?: number | null;
  scale?: 5 | 10;
  size?: number;
  className?: string;
  showValue?: boolean;
}) {
  if (value == null) {
    return <span className={cn("text-xs text-ink-faint", className)}>Noch nicht bewertet</span>;
  }
  const outOfFive = scale === 10 ? value / 2 : value;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, outOfFive - i));
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star size={size} className="absolute inset-0 text-honey-300/45" strokeWidth={1.5} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="text-honey-400" fill="currentColor" strokeWidth={1.5} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className="ml-1 text-sm font-semibold tabular-nums text-ink">
          {value.toFixed(scale === 10 ? 1 : 1).replace(".0", "")}
          <span className="text-ink-faint">/{scale}</span>
        </span>
      ) : null}
    </span>
  );
}
