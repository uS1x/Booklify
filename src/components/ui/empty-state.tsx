import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/12 px-6 py-14 text-center dark:border-white/12",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-paper-deep/60 text-ink-soft dark:bg-white/8">
          {icon}
        </span>
      ) : null}
      <h3 className="text-lg text-ink">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-ink-faint">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
