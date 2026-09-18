import { cn } from "@/lib/cn";
import { formatNumber, progressPercent } from "@/lib/format";

export function ProgressBar({
  value,
  className,
  tone = "bg-clay-400",
  height = "h-2",
}: {
  value: number;
  className?: string;
  tone?: string;
  height?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/12", height, className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ReadingProgressLine({
  currentPage,
  pageCount,
  className,
  compact,
}: {
  currentPage: number;
  pageCount?: number | null;
  className?: string;
  compact?: boolean;
}) {
  const pct = progressPercent(currentPage, pageCount);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-ink-soft">
        <span className="tabular-nums">
          {formatNumber(currentPage)}
          {pageCount ? ` / ${formatNumber(pageCount)} Seiten` : " Seiten"}
        </span>
        <span className="font-semibold tabular-nums text-ink">{pct} % gelesen</span>
      </div>
      <ProgressBar value={pct} height={compact ? "h-1.5" : "h-2"} />
    </div>
  );
}
