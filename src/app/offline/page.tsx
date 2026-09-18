import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-paper-deep/70 text-ink-soft dark:bg-white/10">
        <WifiOff size={26} />
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-ink">Gerade offline</h1>
      <p className="max-w-sm text-sm text-ink-faint">
        Zuletzt geöffnete Seiten deines Regals sind weiterhin verfügbar. Sobald du wieder
        Verbindung hast, werden Fortschritt, Ausleihen und Benachrichtigungen synchronisiert.
      </p>
      {/* Bewusst ein echter Seitenaufruf: offline soll der Browser neu laden,
          nicht der Client-Router navigieren. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="mt-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-clay-600 dark:bg-clay-400 dark:text-ink"
      >
        Erneut versuchen
      </a>
    </main>
  );
}
