import { ACCENT_HEX } from "@/lib/constants";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Avatar({
  name,
  accentColor,
  size = "md",
  className,
}: {
  name: string;
  accentColor?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
    xl: "size-20 text-2xl",
  } as const;
  const hex = ACCENT_HEX(accentColor);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/70 dark:ring-white/10",
        sizes[size],
        className,
      )}
      style={{ backgroundImage: `linear-gradient(140deg, ${hex}, ${hex}bb)` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
