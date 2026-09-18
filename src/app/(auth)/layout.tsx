import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Bühne mit Bücherstapel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-clay-500 via-clay-600 to-wood-500 p-12 lg:flex lg:flex-col">
        <div className="relative z-10 flex items-center gap-2.5 text-paper">
          <span className="flex h-9 w-8 items-end justify-center gap-[2px] rounded-md bg-white/15 p-1">
            <span className="h-4 w-1.5 rounded-sm bg-honey-200/90" />
            <span className="h-6 w-1.5 rounded-sm bg-paper/90" />
            <span className="h-3 w-1.5 rounded-sm bg-sage-200/90" />
          </span>
          <span className="font-[family-name:var(--font-display)] text-lg">Bücherregal</span>
        </div>

        <div className="relative z-10 mt-auto max-w-lg">
          <p className="font-[family-name:var(--font-display)] text-4xl leading-tight text-paper">
            Deine Bücher, dein Leseleben – und eine Bibliothek, die du mit Freunden teilst.
          </p>
          <p className="mt-5 text-paper/80">
            Lesefortschritt festhalten, Moodboards gestalten, Fragebögen ausfüllen und Bücher
            untereinander verleihen. Privat, solange du es möchtest.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-sm text-paper/90">
            {["Regalansicht", "Lesetagebuch", "Moodboards", "Ausleihsystem", "Statistiken"].map((tag) => (
              <span key={tag} className="rounded-full bg-white/12 px-3 py-1.5 backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* dekorative Buchrücken */}
        <div className="pointer-events-none absolute -right-10 top-1/2 flex -translate-y-1/2 rotate-6 items-end gap-2 opacity-40">
          {[
            ["#fbecd2", 200], ["#e6ede4", 260], ["#f2cec8", 180],
            ["#ece3ec", 300], ["#bed1de", 230], ["#f5d9a8", 275],
          ].map(([color, height], i) => (
            <span
              key={i}
              className="w-9 rounded-t-sm shadow-xl"
              style={{ background: color as string, height: height as number }}
            />
          ))}
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-md">
          <Brand className="mb-8 lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  );
}
