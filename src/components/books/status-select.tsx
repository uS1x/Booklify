"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import { READING_STATUSES, READING_STATUS_META, type ReadingStatus } from "@/lib/constants";
import { setStatusAction } from "@/server/actions/books";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export function StatusSelect({
  userBookId,
  status,
  className,
  size = "md",
}: {
  userBookId: string;
  status: ReadingStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const meta = READING_STATUS_META[status];

  const change = (next: ReadingStatus) => {
    setOpen(false);
    if (next === status) return;
    startTransition(async () => {
      const result = await setStatusAction(userBookId, next);
      if (result.ok) {
        toast(`Status: ${READING_STATUS_META[next].label}`);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-full font-medium transition-colors disabled:opacity-60",
          meta.tone,
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        )}
      >
        <span aria-hidden>{meta.emoji}</span>
        {meta.label}
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-ink/8 bg-surface p-1.5 shadow-lift dark:border-white/10">
            {READING_STATUSES.map((value) => {
              const item = READING_STATUS_META[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => change(value)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-ink/5 dark:hover:bg-white/8"
                >
                  <span aria-hidden>{item.emoji}</span>
                  <span className="flex-1">{item.label}</span>
                  {value === status ? <Check size={15} className="text-clay-500" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
