"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-clay-100 text-clay-600 dark:bg-clay-500/20 dark:text-clay-200">
        <TriangleAlert size={24} />
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-ink">Da ist etwas verrutscht</h1>
      <p className="max-w-sm text-sm text-ink-faint">
        Die Seite konnte nicht geladen werden. Dein Regal und deine Notizen sind unversehrt.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw size={16} />
          Erneut versuchen
        </Button>
        <ButtonLink href="/" variant="soft">
          Zum Regal
        </ButtonLink>
      </div>
    </div>
  );
}
