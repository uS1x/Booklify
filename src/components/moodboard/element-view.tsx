import type { MoodboardElementDTO } from "@/server/queries/moodboard";
import { cn } from "@/lib/cn";

export const FONT_CLASS: Record<string, string> = {
  display: "font-[family-name:var(--font-display)]",
  sans: "font-[family-name:var(--font-inter)]",
  hand: "font-[family-name:var(--font-caveat)]",
};

export const BACKGROUNDS: { key: string; label: string; className: string }[] = [
  { key: "paper", label: "Papier", className: "bg-paper-soft" },
  { key: "cream", label: "Creme", className: "bg-[#f7ecd9]" },
  { key: "linen", label: "Leinen", className: "bg-[#eae3d6]" },
  { key: "cork", label: "Pinnwand", className: "corkboard" },
  { key: "dark", label: "Nacht", className: "bg-[#241f1b]" },
  { key: "blush", label: "Rosé", className: "bg-[#f6e3e0]" },
  { key: "sage", label: "Salbei", className: "bg-[#e3ebe1]" },
];

export const backgroundClass = (key: string) =>
  BACKGROUNDS.find((b) => b.key === key)?.className ?? "bg-paper-soft";

export const DEFAULT_FONT_SIZE: Record<string, number> = { TEXT: 26, NOTE: 18 };

/**
 * Darstellung eines Moodboard-Elements – identisch im Editor und in der
 * Vorschau. `fontSize` erlaubt skalierte Einheiten (z. B. cqw) für Vorschauen.
 */
export function ElementView({
  element,
  fontSize,
}: {
  element: MoodboardElementDTO;
  fontSize?: string;
}) {
  const resolvedFontSize =
    fontSize ?? `${element.fontSize ?? DEFAULT_FONT_SIZE[element.type] ?? 20}px`;

  if (element.type === "IMAGE" || element.type === "DRAWING") {
    return (
      <img
        src={element.src ?? ""}
        alt={element.text ?? "Moodboard-Bild"}
        draggable={false}
        className={cn(
          "pointer-events-none size-full",
          element.type === "DRAWING"
            ? "rounded-xl bg-white/85 object-contain p-1"
            : "rounded-lg object-cover",
        )}
      />
    );
  }

  if (element.type === "COLOR") {
    return <div className="size-full rounded-lg" style={{ backgroundColor: element.color ?? "#b9654c" }} />;
  }

  if (element.type === "NOTE") {
    return (
      <div
        className={cn(
          "size-full overflow-hidden rounded-sm px-[4%] py-[3%] text-[#2b2420] shadow-soft",
          FONT_CLASS[element.fontFamily ?? "hand"],
        )}
        style={{
          backgroundColor: element.color ?? "#fbecd2",
          fontSize: resolvedFontSize,
          lineHeight: 1.35,
        }}
      >
        <span className="break-words whitespace-pre-wrap">{element.text}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("size-full overflow-hidden", FONT_CLASS[element.fontFamily ?? "display"])}
      style={{
        color: element.color ?? "#2b2420",
        fontSize: resolvedFontSize,
        lineHeight: 1.2,
      }}
    >
      <span className="break-words whitespace-pre-wrap">{element.text}</span>
    </div>
  );
}
