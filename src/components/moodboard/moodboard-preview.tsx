import Link from "next/link";
import { Palette } from "lucide-react";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/components/moodboard/canvas-size";
import { DEFAULT_FONT_SIZE, ElementView, backgroundClass } from "@/components/moodboard/element-view";
import type { MoodboardDTO } from "@/server/queries/moodboard";
import { cn } from "@/lib/cn";

/**
 * Verkleinerte, nicht bearbeitbare Vorschau. Positionen werden in Prozent und
 * Schriftgrößen in Container-Query-Einheiten umgerechnet – dadurch skaliert die
 * Vorschau ohne JavaScript exakt mit.
 */
export function MoodboardPreview({
  moodboard,
  href,
  className,
}: {
  moodboard: MoodboardDTO;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-ink/8 shadow-soft transition-shadow hover:shadow-lift dark:border-white/8",
        className,
      )}
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`, containerType: "inline-size" }}
    >
      <div className={cn("absolute inset-0", backgroundClass(moodboard.background))}>
        {moodboard.elements.map((element) => {
          const size = element.fontSize ?? DEFAULT_FONT_SIZE[element.type] ?? 20;
          return (
            <div
              key={element.id}
              className="absolute"
              style={{
                left: `${(element.x / CANVAS_WIDTH) * 100}%`,
                top: `${(element.y / CANVAS_HEIGHT) * 100}%`,
                width: `${(element.width / CANVAS_WIDTH) * 100}%`,
                height: `${(element.height / CANVAS_HEIGHT) * 100}%`,
                transform: `rotate(${element.rotation}deg)`,
                zIndex: element.zIndex,
              }}
            >
              <ElementView element={element} fontSize={`${(size / CANVAS_WIDTH) * 100}cqw`} />
            </div>
          );
        })}
      </div>

      <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-xs text-paper opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <Palette size={13} />
        Moodboard öffnen
      </span>
    </Link>
  );
}
