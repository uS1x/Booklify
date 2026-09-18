"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-ink/12 bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint/70 " +
  "transition-colors focus:border-clay-300 focus:outline-none focus:ring-4 focus:ring-clay-200/40 " +
  "dark:border-white/12 dark:bg-white/5 dark:focus:border-clay-400/60 dark:focus:ring-clay-500/20";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-ink">
          <span className="min-w-0">{label}</span>
          {optional ? (
            <span className="text-xs font-normal whitespace-nowrap text-ink-faint">optional</span>
          ) : null}
        </span>
      ) : null}
      {children}
      {hint && !error ? <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span> : null}
      {error ? <span className="mt-1.5 block text-xs text-clay-600 dark:text-clay-300">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "appearance-none bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  name,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        name={name}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-clay-500" : "bg-ink/15 dark:bg-white/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all duration-200",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
