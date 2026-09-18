"use client";

import { useState } from "react";
import { COVER_PALETTES } from "@/lib/constants";
import { hashToIndex } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Buchcover mit Buchrücken, Glanzkante und – falls kein Bild vorhanden oder
 * ladbar ist – einem gestalteten Farbcover aus Titel und Autor.
 */
export function BookCover({
  title,
  author,
  coverUrl,
  className,
  rounded = "rounded-[3px_8px_8px_3px]",
  textScale = 1,
  priority,
}: {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  className?: string;
  rounded?: string;
  textScale?: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(coverUrl) && !failed;
  const [from, to] = COVER_PALETTES[hashToIndex(title, COVER_PALETTES.length)];

  return (
    <div
      className={cn(
        "relative isolate size-full overflow-hidden bg-paper-deep select-none",
        rounded,
        className,
      )}
      style={
        showImage
          ? undefined
          : { backgroundImage: `linear-gradient(155deg, ${from} 0%, ${from} 22%, ${to} 100%)` }
      }
    >
      {showImage ? (
        <img
          src={coverUrl ?? ""}
          alt={`Cover von ${title}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between p-[7%] text-white"
          style={{ fontSize: `${textScale}rem`, textShadow: "0 1px 2px rgb(0 0 0 / 0.35)" }}
        >
          <span
            className="font-[family-name:var(--font-display)] leading-tight"
            style={{ fontSize: `${textScale * 0.95}em` }}
          >
            {title}
          </span>
          <span className="opacity-90" style={{ fontSize: `${textScale * 0.6}em` }}>
            {author}
          </span>
        </div>
      )}

      {/* Buchrücken links */}
      <div className="book-edge pointer-events-none absolute inset-y-0 left-0 w-[9%] min-w-1" />
      {/* Glanz über dem Cover – auf Farbcovern dezenter, damit der Text lesbar bleibt */}
      <div
        className={cn(
          "book-spine-sheen pointer-events-none absolute inset-0",
          showImage ? "opacity-70" : "opacity-25",
        )}
      />
      {/* Seitenschnitt rechts */}
      <div className="pointer-events-none absolute inset-y-[3%] right-0 w-[2px] bg-white/45" />
    </div>
  );
}
