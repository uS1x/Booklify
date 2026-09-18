"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Brush, ChevronDown, ChevronUp, Copy, ImagePlus, Palette, RotateCw, StickyNote,
  Trash2, Type as TypeIcon,
} from "lucide-react";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/components/moodboard/canvas-size";
import { BACKGROUNDS, DEFAULT_FONT_SIZE, ElementView, backgroundClass } from "@/components/moodboard/element-view";
import { ImagePicker, type PickedImage } from "@/components/moodboard/image-picker";
import { DrawingCanvas } from "@/components/moodboard/drawing-canvas";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  addMoodboardElementAction, deleteDrawingAction, deleteMoodboardElementAction,
  saveDrawingAction, updateMoodboardAction, updateMoodboardElementsAction,
} from "@/server/actions/moodboard";
import { cn } from "@/lib/cn";
import type { DrawingDTO, MoodboardDTO, MoodboardElementDTO } from "@/server/queries/moodboard";

const ELEMENT_COLORS = [
  "#b9654c", "#e0a458", "#7e9a7b", "#6b8ca3", "#8c6b8e",
  "#e4a9a0", "#fbecd2", "#2b2420", "#ffffff",
];

type Mode =
  | { kind: "idle" }
  | { kind: "move"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: "resize"; id: string; startX: number; startY: number; width: number; height: number }
  | { kind: "rotate"; id: string; centerX: number; centerY: number; startAngle: number; origin: number };

/**
 * Freier Moodboard-Editor: Elemente lassen sich verschieben, skalieren,
 * drehen, stapeln und löschen – mit Maus wie mit Finger.
 */
export function MoodboardEditor({
  userBookId,
  bookTitle,
  initial,
  drawings: initialDrawings,
  imageProvider,
  openDrawing,
}: {
  userBookId: string;
  bookTitle: string;
  initial: MoodboardDTO | null;
  drawings: DrawingDTO[];
  imageProvider: { id: string; label: string; configured: boolean; hint: string };
  openDrawing?: boolean;
}) {
  const [elements, setElements] = useState<MoodboardElementDTO[]>(initial?.elements ?? []);
  const [drawings, setDrawings] = useState(initialDrawings);
  const [background, setBackground] = useState(initial?.background ?? "paper");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [imageOpen, setImageOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(Boolean(openDrawing));
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [, startTransition] = useTransition();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mode = useRef<Mode>({ kind: "idle" });
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const selected = elements.find((element) => element.id === selectedId) ?? null;

  useEffect(() => () => {
    if (textTimer.current) clearTimeout(textTimer.current);
  }, []);

  /* Canvas an die Containerbreite anpassen. */
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / CANVAS_WIDTH);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const persist = useCallback(
    (id: string, patch: Partial<MoodboardElementDTO>) => {
      startTransition(async () => {
        const result = await updateMoodboardElementsAction(userBookId, [
          { id, patch: patch as Record<string, never> },
        ]);
        if (!result.ok) toast(result.error, "error");
      });
    },
    [userBookId, toast],
  );

  const patchLocal = (id: string, patch: Partial<MoodboardElementDTO>) =>
    setElements((prev) => prev.map((element) => (element.id === id ? { ...element, ...patch } : element)));

  /** Tippen speichert automatisch – niemand soll Text durch Wegklicken verlieren. */
  const patchTextDebounced = (id: string, text: string) => {
    patchLocal(id, { text });
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = setTimeout(() => persist(id, { text }), 600);
  };

  const nextZ = () => elements.reduce((max, element) => Math.max(max, element.zIndex), 0) + 1;

  const add = (
    input: Partial<MoodboardElementDTO> & Pick<MoodboardElementDTO, "type" | "width" | "height">,
  ) => {
    const payload = {
      type: input.type,
      x: input.x ?? Math.round(CANVAS_WIDTH / 2 - input.width / 2 + (Math.random() * 80 - 40)),
      y: input.y ?? Math.round(CANVAS_HEIGHT / 2 - input.height / 2 + (Math.random() * 80 - 40)),
      width: input.width,
      height: input.height,
      rotation: input.rotation ?? Math.round((Math.random() * 6 - 3) * 10) / 10,
      zIndex: nextZ(),
      src: input.src ?? null,
      text: input.text ?? null,
      color: input.color ?? null,
      fontFamily: (input.fontFamily as "display" | "sans" | "hand" | null) ?? null,
      fontSize: input.fontSize ?? null,
      meta: input.meta ?? null,
    };

    startTransition(async () => {
      const result = await addMoodboardElementAction(userBookId, payload);
      if (result.ok) {
        setElements((prev) => [...prev, result.data]);
        setSelectedId(result.data.id);
      } else {
        toast(result.error, "error");
      }
    });
  };

  const remove = (id: string) => {
    setElements((prev) => prev.filter((element) => element.id !== id));
    setSelectedId(null);
    startTransition(async () => {
      const result = await deleteMoodboardElementAction(userBookId, id);
      if (!result.ok) toast(result.error, "error");
    });
  };

  const duplicate = (element: MoodboardElementDTO) =>
    add({ ...element, x: element.x + 28, y: element.y + 28 });

  const changeBackground = (key: string) => {
    setBackground(key);
    startTransition(async () => {
      const result = await updateMoodboardAction(userBookId, { background: key });
      if (!result.ok) toast(result.error, "error");
    });
  };

  const addPickedImage = (image: PickedImage) => {
    const ratio = image.width && image.height ? image.height / image.width : 0.72;
    const width = 300;
    add({
      type: "IMAGE",
      width,
      height: Math.round(width * ratio),
      src: image.url,
      text: image.credit?.author ? `${image.credit.author} · ${image.credit.source}` : null,
      meta: image.credit ? (image.credit as unknown as Record<string, unknown>) : null,
    });
  };

  /* ── Zeiger-Interaktionen ─────────────────────────────────────────── */

  const onPointerDownElement = (
    event: React.PointerEvent,
    element: MoodboardElementDTO,
    action: "move" | "resize" | "rotate",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    setSelectedId(element.id);

    if (action === "move") {
      mode.current = {
        kind: "move",
        id: element.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: element.x,
        originY: element.y,
      };
    } else if (action === "resize") {
      mode.current = {
        kind: "resize",
        id: element.id,
        startX: event.clientX,
        startY: event.clientY,
        width: element.width,
        height: element.height,
      };
    } else {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centerX = rect.left + (element.x + element.width / 2) * scale;
      const centerY = rect.top + (element.y + element.height / 2) * scale;
      const startAngle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
      mode.current = { kind: "rotate", id: element.id, centerX, centerY, startAngle, origin: element.rotation };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = mode.current;
    if (current.kind === "idle") return;

    if (current.kind === "move") {
      const dx = (event.clientX - current.startX) / scale;
      const dy = (event.clientY - current.startY) / scale;
      patchLocal(current.id, {
        x: Math.round(Math.max(-120, Math.min(CANVAS_WIDTH - 40, current.originX + dx))),
        y: Math.round(Math.max(-120, Math.min(CANVAS_HEIGHT - 40, current.originY + dy))),
      });
    } else if (current.kind === "resize") {
      const dx = (event.clientX - current.startX) / scale;
      const dy = (event.clientY - current.startY) / scale;
      patchLocal(current.id, {
        width: Math.round(Math.max(48, Math.min(CANVAS_WIDTH, current.width + dx))),
        height: Math.round(Math.max(40, Math.min(CANVAS_HEIGHT, current.height + dy))),
      });
    } else if (current.kind === "rotate") {
      const angle = (Math.atan2(event.clientY - current.centerY, event.clientX - current.centerX) * 180) / Math.PI;
      const next = Math.round(current.origin + (angle - current.startAngle));
      patchLocal(current.id, { rotation: Math.max(-180, Math.min(180, next)) });
    }
  };

  const onPointerUp = () => {
    const current = mode.current;
    mode.current = { kind: "idle" };
    if (current.kind === "idle") return;
    const element = elements.find((entry) => entry.id === current.id);
    if (!element) return;

    if (current.kind === "move") persist(element.id, { x: element.x, y: element.y });
    if (current.kind === "resize") persist(element.id, { width: element.width, height: element.height });
    if (current.kind === "rotate") persist(element.id, { rotation: element.rotation });
  };

  /* Tastatur: löschen, verschieben, abwählen. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selected) return;
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove(selected.id);
      }
      const step = event.shiftKey ? 20 : 4;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const delta = moves[event.key];
      if (delta) {
        event.preventDefault();
        const next = { x: selected.x + delta[0], y: selected.y + delta[1] };
        patchLocal(selected.id, next);
        persist(selected.id, next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const saveDrawing = (dataUrl: string, size: { width: number; height: number }) => {
    setSavingDrawing(true);
    startTransition(async () => {
      const result = await saveDrawingAction(userBookId, {
        dataUrl,
        width: size.width,
        height: size.height,
        title: `Skizze zu ${bookTitle}`,
        addToBoard: true,
      });
      setSavingDrawing(false);
      if (result.ok) {
        // Element und Galerie ohne Neuladen ergänzen.
        if (result.data.element) {
          setElements((prev) => [...prev, result.data.element!]);
          setSelectedId(result.data.element.id);
        }
        setDrawings((prev) => [
          {
            id: result.data.id,
            title: `Skizze zu ${bookTitle}`,
            dataUrl,
            width: size.width,
            height: size.height,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast("Zeichnung gespeichert und aufs Board gelegt");
        setDrawOpen(false);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Werkzeugleiste ─────────────────────────────────────────────── */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/8 bg-surface/95 p-2 shadow-soft backdrop-blur-xl dark:border-white/8">
        <Button variant="soft" size="sm" onClick={() => setImageOpen(true)}>
          <ImagePlus size={15} />
          Bild
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() =>
            add({ type: "TEXT", width: 340, height: 90, text: "Neuer Text", fontFamily: "display", fontSize: 30, color: "#2b2420" })
          }
        >
          <TypeIcon size={15} />
          Text
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() =>
            add({ type: "NOTE", width: 230, height: 200, text: "Notiz …", fontFamily: "hand", fontSize: 20, color: "#fbecd2" })
          }
        >
          <StickyNote size={15} />
          Notiz
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => add({ type: "COLOR", width: 150, height: 150, color: ELEMENT_COLORS[Math.floor(Math.random() * 6)] })}
        >
          <Palette size={15} />
          Farbe
        </Button>
        <Button variant="soft" size="sm" onClick={() => setDrawOpen(true)}>
          <Brush size={15} />
          Zeichnen
        </Button>

        <span className="mx-1 hidden h-6 w-px bg-ink/10 sm:block dark:bg-white/10" />

        <div className="flex items-center gap-1.5">
          {BACKGROUNDS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              title={entry.label}
              aria-label={`Hintergrund ${entry.label}`}
              onClick={() => changeBackground(entry.key)}
              className={cn(
                "size-7 rounded-lg border-2 transition-transform",
                entry.className,
                background === entry.key ? "scale-110 border-clay-500" : "border-ink/10 hover:scale-105 dark:border-white/20",
              )}
            />
          ))}
        </div>

        <span className="ml-auto text-xs text-ink-faint">
          {elements.length ? `${elements.length} Elemente` : "leeres Board"}
        </span>
      </div>

      {/* ── Arbeitsfläche ─────────────────────────────────────────────── */}
      <div
        ref={wrapperRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerDown={() => setSelectedId(null)}
        className={cn(
          "relative w-full touch-none-safe overflow-hidden rounded-3xl border border-ink/10 shadow-soft",
          backgroundClass(background),
        )}
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${scale})` }}
        >
          {elements.map((element) => {
            const active = element.id === selectedId;
            return (
              <div
                key={element.id}
                onPointerDown={(event) => onPointerDownElement(event, element, "move")}
                className={cn("absolute cursor-grab active:cursor-grabbing", active && "z-50")}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  transform: `rotate(${element.rotation}deg)`,
                  zIndex: active ? 999 : element.zIndex,
                }}
              >
                <ElementView element={element} />

                {active ? (
                  <>
                    <span className="pointer-events-none absolute -inset-1 rounded-lg border-2 border-clay-400/80" />
                    {/* Drehen */}
                    <button
                      type="button"
                      aria-label="Drehen"
                      onPointerDown={(event) => onPointerDownElement(event, element, "rotate")}
                      className="absolute -top-9 left-1/2 flex size-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-ink text-paper shadow-lift dark:bg-clay-400 dark:text-ink"
                    >
                      <RotateCw size={13} />
                    </button>
                    {/* Größe */}
                    <button
                      type="button"
                      aria-label="Größe ändern"
                      onPointerDown={(event) => onPointerDownElement(event, element, "resize")}
                      className="absolute -right-2.5 -bottom-2.5 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-clay-500 shadow-lift"
                    />
                  </>
                ) : null}
              </div>
            );
          })}

          {!elements.length ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <Palette size={28} className="text-ink/25" />
              <p className="max-w-xs text-sm text-ink/45">
                Leere Pinnwand für „{bookTitle}“ – füge Bilder, Notizen, Farben oder eine Zeichnung hinzu.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Inspektor ─────────────────────────────────────────────────── */}
      {selected ? (
        <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-soft dark:border-white/8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">
              {selected.type === "IMAGE"
                ? "Bild"
                : selected.type === "TEXT"
                  ? "Text"
                  : selected.type === "NOTE"
                    ? "Notiz"
                    : selected.type === "DRAWING"
                      ? "Zeichnung"
                      : "Farbfläche"}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = nextZ();
                  patchLocal(selected.id, { zIndex: next });
                  persist(selected.id, { zIndex: next });
                }}
              >
                <ChevronUp size={15} />
                nach vorn
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  patchLocal(selected.id, { zIndex: 0 });
                  persist(selected.id, { zIndex: 0 });
                }}
              >
                <ChevronDown size={15} />
                nach hinten
              </Button>
              <Button variant="ghost" size="sm" onClick={() => duplicate(selected)}>
                <Copy size={15} />
                duplizieren
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                <Trash2 size={15} />
                löschen
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {selected.type === "TEXT" || selected.type === "NOTE" ? (
              <>
                <Field label="Inhalt">
                  <Textarea
                    value={selected.text ?? ""}
                    rows={3}
                    onChange={(event) => patchTextDebounced(selected.id, event.target.value)}
                    onBlur={(event) => persist(selected.id, { text: event.target.value })}
                  />
                </Field>
                <div className="flex flex-col gap-3">
                  <Field label="Schrift">
                    <div className="flex gap-1.5">
                      {(["display", "sans", "hand"] as const).map((font) => (
                        <button
                          key={font}
                          type="button"
                          onClick={() => {
                            patchLocal(selected.id, { fontFamily: font });
                            persist(selected.id, { fontFamily: font });
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm transition-colors",
                            selected.fontFamily === font
                              ? "border-transparent bg-ink text-paper dark:bg-clay-400 dark:text-ink"
                              : "border-ink/12 text-ink-soft dark:border-white/12",
                          )}
                        >
                          {font === "display" ? "Serif" : font === "sans" ? "Sans" : "Hand"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={`Schriftgröße: ${selected.fontSize ?? DEFAULT_FONT_SIZE[selected.type] ?? 20} px`}>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={selected.fontSize ?? DEFAULT_FONT_SIZE[selected.type] ?? 20}
                      onChange={(event) => patchLocal(selected.id, { fontSize: Number(event.target.value) })}
                      onPointerUp={(event) =>
                        persist(selected.id, { fontSize: Number((event.target as HTMLInputElement).value) })
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink/10 accent-clay-500 dark:bg-white/15"
                    />
                  </Field>
                </div>
              </>
            ) : null}

            {selected.type !== "IMAGE" && selected.type !== "DRAWING" ? (
              <Field label={selected.type === "NOTE" ? "Zettelfarbe" : "Farbe"}>
                <div className="flex flex-wrap gap-1.5">
                  {ELEMENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Farbe ${color}`}
                      onClick={() => {
                        patchLocal(selected.id, { color });
                        persist(selected.id, { color });
                      }}
                      className={cn(
                        "size-8 rounded-full border-2 transition-transform",
                        selected.color === color ? "scale-110 border-clay-500" : "border-ink/10 hover:scale-105 dark:border-white/20",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </Field>
            ) : null}

            <Field label={`Drehung: ${Math.round(selected.rotation)}°`}>
              <input
                type="range"
                min={-45}
                max={45}
                value={selected.rotation}
                onChange={(event) => patchLocal(selected.id, { rotation: Number(event.target.value) })}
                onPointerUp={(event) =>
                  persist(selected.id, { rotation: Number((event.target as HTMLInputElement).value) })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink/10 accent-clay-500 dark:bg-white/15"
              />
            </Field>

            <Field label="Größe">
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={Math.round(selected.width)}
                  onChange={(event) => patchLocal(selected.id, { width: Number(event.target.value) })}
                  onBlur={(event) => persist(selected.id, { width: Number(event.target.value) })}
                  aria-label="Breite"
                />
                <Input
                  type="number"
                  value={Math.round(selected.height)}
                  onChange={(event) => patchLocal(selected.id, { height: Number(event.target.value) })}
                  onBlur={(event) => persist(selected.id, { height: Number(event.target.value) })}
                  aria-label="Höhe"
                />
              </div>
            </Field>
          </div>
        </div>
      ) : (
        <p className="text-xs text-ink-faint">
          Element antippen zum Auswählen · ziehen zum Verschieben · Griffe für Drehen und Skalieren ·
          Pfeiltasten verschieben, Entf löscht.
        </p>
      )}

      {/* ── Zeichnungen ───────────────────────────────────────────────── */}
      {drawings.length ? (
        <div className="rounded-2xl border border-ink/8 bg-surface p-4 dark:border-white/8">
          <p className="mb-3 text-sm font-medium text-ink">Gespeicherte Zeichnungen</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {drawings.map((drawing) => (
              <div key={drawing.id} className="group relative overflow-hidden rounded-xl border border-ink/8 bg-white p-1 dark:border-white/10">
                <img src={drawing.dataUrl} alt={drawing.title ?? "Zeichnung"} className="aspect-4/3 w-full object-contain" />
                <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() =>
                      add({
                        type: "DRAWING",
                        width: 320,
                        height: Math.round((320 * drawing.height) / drawing.width),
                        src: drawing.dataUrl,
                        text: drawing.title,
                      })
                    }
                    className="flex-1 rounded-lg bg-ink/80 px-2 py-1 text-[11px] text-paper"
                  >
                    aufs Board
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteDrawingAction(userBookId, drawing.id);
                        if (result.ok) setDrawings((prev) => prev.filter((entry) => entry.id !== drawing.id));
                        else toast(result.error, "error");
                      })
                    }
                    aria-label="Zeichnung löschen"
                    className="rounded-lg bg-clay-600/90 px-2 py-1 text-[11px] text-white"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ImagePicker
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onPick={addPickedImage}
        providerLabel={imageProvider.label}
        providerConfigured={imageProvider.configured}
        providerHint={imageProvider.hint}
        suggestion={bookTitle.split(" ").slice(0, 2).join(" ")}
      />

      <Modal open={drawOpen} onClose={() => setDrawOpen(false)} title="Zeichnen" size="xl">
        <div className="py-1">
          <DrawingCanvas onSave={saveDrawing} saving={savingDrawing} />
        </div>
      </Modal>
    </div>
  );
}
