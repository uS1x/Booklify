import { formatNumber } from "@/lib/format";

export type BarDatum = { label: string; value: number; hint?: string };

/**
 * Waagerechte Balken für Ranglisten (Genres, Jahre). Die Identität steckt in
 * der Beschriftung, daher genügt eine Farbe – keine Farb-nach-Rang-Logik.
 */
export function BarList({
  data,
  unit = "",
  emptyLabel = "Noch keine Daten",
}: {
  data: BarDatum[];
  unit?: string;
  emptyLabel?: string;
}) {
  if (!data.length) {
    return <p className="py-6 text-sm text-ink-faint">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {data.map((entry) => (
        <li key={entry.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{entry.label}</span>
            <span className="shrink-0 text-ink-soft tabular-nums">
              {formatNumber(entry.value)}
              {unit}
              {entry.hint ? <span className="ml-1.5 text-xs text-ink-faint">{entry.hint}</span> : null}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--color-chart-track)" }}
            title={`${entry.label}: ${formatNumber(entry.value)}${unit}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out group-hover:opacity-80"
              style={{
                width: `${Math.max(2, (entry.value / max) * 100)}%`,
                backgroundColor: "var(--color-chart-mark)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
