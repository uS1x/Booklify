import { Check, X } from "lucide-react";

import { cn } from "@/lib/cn";
import type { QuestionConfig } from "@/server/queries/questions";
import type { QuestionType } from "@/lib/constants";

/** Anzeige einer gespeicherten Antwort, passend zum Fragetyp. */
export function AnswerValue({
  type,
  value,
  config,
}: {
  type: QuestionType;
  value: unknown;
  config: QuestionConfig;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-sm text-ink-faint">übersprungen</span>;
  }

  if (type === "RATING_5" || type === "RATING_10") {
    const max = type === "RATING_5" ? 5 : 10;
    const current = Number(value);
    return (
      <span className="flex items-center gap-2">
        <span className="flex gap-0.5">
          {Array.from({ length: max }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full",
                max === 5 ? "w-5" : "w-2.5",
                i < current ? "bg-clay-400" : "bg-ink/12 dark:bg-white/15",
              )}
            />
          ))}
        </span>
        <span className="text-sm font-semibold text-ink tabular-nums">
          {current}
          <span className="text-ink-faint">/{max}</span>
        </span>
      </span>
    );
  }

  if (type === "SLIDER") {
    const { min = 0, max = 100, unit = "" } = config;
    const pct = ((Number(value) - min) / (max - min)) * 100;
    return (
      <span className="flex items-center gap-2">
        <span className="relative h-1.5 w-28 rounded-full bg-ink/12 dark:bg-white/15">
          <span className="absolute inset-y-0 left-0 rounded-full bg-clay-400" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-sm text-ink tabular-nums">
          {String(value)}
          {unit}
        </span>
      </span>
    );
  }

  if (type === "YES_NO") {
    const yes = value === true;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          yes
            ? "bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200"
            : "bg-paper-deep/70 text-ink-soft dark:bg-white/10",
        )}
      >
        {yes ? <Check size={12} /> : <X size={12} />}
        {yes ? "Ja" : "Nein"}
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {value.map((entry) => (
          <span
            key={String(entry)}
            className="rounded-full bg-paper-deep/70 px-2.5 py-1 text-xs text-ink dark:bg-white/10"
          >
            {String(entry)}
          </span>
        ))}
      </span>
    );
  }

  if (type === "TEXT") {
    return <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{String(value)}</p>;
  }

  return (
    <span className="rounded-full bg-paper-deep/70 px-2.5 py-1 text-xs text-ink dark:bg-white/10">
      {String(value)}
    </span>
  );
}
