import { formatNumber } from "@/lib/format";

export type ColumnDatum = { label: string; value: number; sublabel?: string };

/**
 * Säulendiagramm für eine Messreihe: eine Farbe, sparsame Direktbeschriftung,
 * zurückhaltendes Raster. Hover-Tooltips über SVG-<title>.
 */
export function ColumnChart({
  data,
  unit = "",
  height = 200,
  emptyLabel = "Noch keine Daten",
}: {
  data: ColumnDatum[];
  unit?: string;
  height?: number;
  emptyLabel?: string;
}) {
  if (!data.length || data.every((entry) => entry.value === 0)) {
    return <p className="py-8 text-center text-sm text-ink-faint">{emptyLabel}</p>;
  }

  const width = 720;
  const padding = { top: 18, right: 8, bottom: 26, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((entry) => entry.value));
  const niceMax = max <= 5 ? Math.max(1, max) : Math.ceil(max / 5) * 5;
  const band = plotWidth / data.length;
  const barWidth = Math.min(24, band - 8);
  const peak = data.reduce((best, entry) => (entry.value > best.value ? entry : best), data[0]);

  // Kleine Wertebereiche bekommen ganzzahlige Schritte, große drei runde Marken.
  const ticks =
    niceMax <= 5
      ? Array.from({ length: niceMax + 1 }, (_, index) => index)
      : [...new Set([0, Math.round(niceMax / 2), niceMax])];

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Säulendiagramm mit ${data.length} Werten, Maximum ${formatNumber(max)}${unit}`}
      >
        {/* Raster + Achsenwerte */}
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - (tick / niceMax) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--color-chart-grid)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-ink-faint text-[10px] tabular-nums"
              >
                {formatNumber(Math.round(tick))}
              </text>
            </g>
          );
        })}

        {data.map((entry, index) => {
          const barHeight = niceMax ? (entry.value / niceMax) * plotHeight : 0;
          const x = padding.left + index * band + (band - barWidth) / 2;
          const y = padding.top + plotHeight - barHeight;
          const isPeak = entry.label === peak.label && entry.value === peak.value && entry.value > 0;

          return (
            <g key={`${entry.label}-${index}`} className="group">
              <title>{`${entry.sublabel ?? entry.label}: ${formatNumber(entry.value)}${unit}`}</title>
              {/* großzügige Trefferfläche für Hover/Touch */}
              <rect
                x={padding.left + index * band}
                y={padding.top}
                width={band}
                height={plotHeight}
                fill="transparent"
              />
              {entry.value > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx={4}
                  fill="var(--color-chart-mark)"
                  className="transition-opacity group-hover:opacity-80"
                />
              ) : (
                <rect
                  x={x}
                  y={padding.top + plotHeight - 2}
                  width={barWidth}
                  height={2}
                  rx={1}
                  fill="var(--color-chart-track)"
                />
              )}

              {isPeak ? (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-ink text-[10px] font-semibold tabular-nums"
                >
                  {formatNumber(entry.value)}
                </text>
              ) : null}

              <text
                x={x + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-ink-faint text-[10px]"
              >
                {entry.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
