"use client";

import { useState } from "react";
import { Check, Heart, Plus, X } from "lucide-react";

import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { QuestionDTO } from "@/server/queries/questions";
import type { QuestionType } from "@/lib/constants";

export type QuestionInputProps = {
  question: QuestionDTO;
  value: unknown;
  onChange: (value: unknown) => void;
};

/* ── Einzelne Fragetypen ─────────────────────────────────────────────────── */

function Rating5({ question, value, onChange }: QuestionInputProps) {
  const current = typeof value === "number" ? value : 0;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} von 5`}
          onClick={() => onChange(current === n ? null : n)}
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl border transition-all active:scale-95",
            n <= current
              ? "border-transparent bg-clay-500 text-white shadow-soft"
              : "border-ink/12 text-ink-faint hover:border-clay-300 hover:text-clay-500 dark:border-white/12",
          )}
        >
          <Heart size={18} fill={n <= current ? "currentColor" : "none"} />
        </button>
      ))}
      {current ? <span className="ml-2 text-sm text-ink-soft tabular-nums">{current} / 5</span> : null}
      {question.config.lowLabel ? (
        <span className="ml-auto text-xs text-ink-faint">{question.config.highLabel}</span>
      ) : null}
    </div>
  );
}

function Rating10({ question, value, onChange }: QuestionInputProps) {
  const current = typeof value === "number" ? value : 0;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(current === n ? null : n)}
            className={cn(
              "size-10 rounded-xl border text-sm font-medium transition-all active:scale-95 tabular-nums",
              n === current
                ? "border-transparent bg-ink text-paper shadow-soft dark:bg-clay-400 dark:text-ink"
                : n < current
                  ? "border-transparent bg-clay-100 text-clay-700 dark:bg-clay-500/25 dark:text-clay-100"
                  : "border-ink/12 text-ink-soft hover:border-clay-300 dark:border-white/12",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {question.config.lowLabel ? (
        <div className="mt-2 flex justify-between text-xs text-ink-faint">
          <span>{question.config.lowLabel}</span>
          <span>{question.config.highLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function SliderInput({ question, value, onChange }: QuestionInputProps) {
  const { min = 0, max = 100, step = 1, unit = "" } = question.config;
  const current = typeof value === "number" ? value : Math.round((min + max) / 2);
  const touched = typeof value === "number";

  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink/10 accent-clay-500 dark:bg-white/15"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-ink-faint">
        <span>{question.config.lowLabel ?? min}</span>
        <span className={cn("font-semibold tabular-nums", touched ? "text-ink" : "text-ink-faint")}>
          {touched ? `${current}${unit}` : "noch nichts gewählt"}
        </span>
        <span>{question.config.highLabel ?? max}</span>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }: QuestionInputProps) {
  const options = [
    { key: true, label: "Ja" },
    { key: false, label: "Nein" },
  ];
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={String(option.key)}
          type="button"
          onClick={() => onChange(value === option.key ? null : option.key)}
          className={cn(
            "flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition-all active:scale-[0.98] sm:flex-none sm:px-8",
            value === option.key
              ? "border-transparent bg-ink text-paper shadow-soft dark:bg-clay-400 dark:text-ink"
              : "border-ink/12 text-ink-soft hover:border-clay-300 dark:border-white/12",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChoiceInput({ question, value, onChange }: QuestionInputProps) {
  const multiple = question.config.multiple ?? false;
  const options = question.config.options ?? [];
  const selected = multiple
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : typeof value === "string"
      ? [value]
      : [];

  const toggle = (option: string) => {
    if (!multiple) {
      onChange(selected.includes(option) ? null : option);
      return;
    }
    const next = selected.includes(option)
      ? selected.filter((o) => o !== option)
      : [...selected, option];
    onChange(next.length ? next : null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all active:scale-95",
              active
                ? "border-transparent bg-clay-500 text-white shadow-soft"
                : "border-ink/12 text-ink-soft hover:border-clay-300 dark:border-white/12",
            )}
          >
            {active ? <Check size={14} /> : null}
            {option}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({ question, value, onChange }: QuestionInputProps) {
  return (
    <Textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value || null)}
      rows={question.config.rows ?? 3}
      placeholder={question.config.placeholder ?? "Deine Gedanken …"}
    />
  );
}

function TagsInput({ question, value, onChange }: QuestionInputProps) {
  const tags = Array.isArray(value) ? (value as string[]) : [];
  const [draft, setDraft] = useState("");
  const suggestions = (question.config.suggestions ?? []).filter((s) => !tags.includes(s));

  const add = (tag: string) => {
    const clean = tag.trim().slice(0, 32);
    if (!clean || tags.includes(clean)) return;
    onChange([...tags, clean]);
    setDraft("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink/12 bg-surface p-2 dark:border-white/12 dark:bg-white/5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-paper-deep/80 px-2.5 py-1 text-xs text-ink dark:bg-white/10"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag).length ? tags.filter((t) => t !== tag) : null)}
              aria-label={`${tag} entfernen`}
              className="text-ink-faint hover:text-clay-600"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && tags.length) {
              onChange(tags.slice(0, -1).length ? tags.slice(0, -1) : null);
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={tags.length ? "" : "Stimmung eingeben und Enter drücken"}
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-faint/80"
        />
      </div>

      {suggestions.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/15 px-2.5 py-1 text-xs text-ink-faint transition-colors hover:border-clay-300 hover:text-ink dark:border-white/15"
            >
              <Plus size={11} />
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Registry der Fragetypen – neue Typen werden hier ergänzt, ohne dass
 * Fragebogen, Datenmodell oder Auswertung angepasst werden müssen.
 */
const RENDERERS: Record<QuestionType, (props: QuestionInputProps) => React.ReactElement> = {
  RATING_5: Rating5,
  RATING_10: Rating10,
  SLIDER: SliderInput,
  YES_NO: YesNo,
  CHOICE: ChoiceInput,
  TEXT: TextInput,
  TAGS: TagsInput,
};

export function QuestionInput(props: QuestionInputProps) {
  const Renderer = RENDERERS[props.question.type] ?? TextInput;
  return <Renderer {...props} />;
}
