import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 " +
  "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper hover:bg-clay-600 shadow-soft hover:shadow-lift dark:bg-clay-400 dark:text-ink dark:hover:bg-clay-300",
  secondary:
    "bg-clay-500 text-white hover:bg-clay-600 shadow-soft hover:shadow-lift",
  soft:
    "bg-paper-deep/70 text-ink hover:bg-paper-deep dark:bg-white/10 dark:hover:bg-white/15",
  ghost:
    "text-ink-soft hover:text-ink hover:bg-ink/5 dark:hover:bg-white/10",
  outline:
    "border border-ink/15 text-ink hover:border-ink/30 hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10",
  danger:
    "bg-clay-700 text-white hover:bg-clay-600 shadow-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
  icon: "h-10 w-10",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
  prefetch,
  target,
  onClick,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href: string;
  children: ReactNode;
  prefetch?: boolean;
  target?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      target={target}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
