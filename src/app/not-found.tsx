import Link from "next/link";
import { BookX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-paper-deep/70 text-ink-soft dark:bg-white/10">
        <BookX size={26} />
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-ink">Diese Seite steht nicht im Regal</h1>
      <p className="max-w-sm text-sm text-ink-faint">
        Vielleicht wurde das Buch entfernt – oder es ist privat. Private Bücher und Regale sind
        grundsätzlich nur für ihre Besitzer sichtbar.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-clay-600 dark:bg-clay-400 dark:text-ink"
      >
        Zurück zum Bücherregal
      </Link>
    </main>
  );
}
