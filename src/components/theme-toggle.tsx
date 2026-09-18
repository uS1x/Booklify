"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "dark" ? "Dunkles Design aktivieren" : "Helles Design aktivieren"}
      title={next === "dark" ? "Dunkles Design" : "Helles Design"}
      className={cn(
        "flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10",
        className,
      )}
    >
      {resolved === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
