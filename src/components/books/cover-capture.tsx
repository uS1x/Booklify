"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImageUp, Loader2, RefreshCw, ScanLine } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  canvasToBlob, detectCoverQuad, loadImage, outputSize, warpQuad, type Point, type Quad,
} from "@/lib/image-crop";

const CORNER_LABELS = ["oben links", "oben rechts", "unten rechts", "unten links"];

/**
 * Cover selbst aufnehmen: Foto machen, Buchkanten automatisch erkennen,
 * perspektivisch entzerren und gerade zuschneiden – wie ein Dokumentenscanner,
 * nur direkt in der App, weil Browser die Scanfunktion von iOS/Android nicht
 * aufrufen können.
 */
export function CoverCapture({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (url: string) => void;
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [busy, setBusy] = useState<null | "reading" | "cropping" | "uploading">(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const magnifierRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<number | null>(null);
  /** Bildkoordinaten der gerade gezogenen Ecke – steuert die Lupe. */
  const [magnifier, setMagnifier] = useState<Point | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) return;
    // Aufräumen, sobald der Dialog geschlossen wird.
    setSource(null);
    setQuad(null);
    setBusy(null);
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, [open]);

  const acceptFile = async (file: File) => {
    setBusy("reading");
    try {
      const canvas = await loadImage(file);
      setSource(canvas);
      setQuad(detectCoverQuad(canvas));
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    } catch {
      toast("Das Bild konnte nicht gelesen werden.", "error");
    } finally {
      setBusy(null);
    }
  };

  const MAGNIFIER_SIZE = 116;
  const MAGNIFIER_ZOOM = 3;

  /** Zeichnet den Ausschnitt um die gezogene Ecke vergrößert in die Lupe. */
  const drawMagnifier = (point: Point) => {
    const canvas = magnifierRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !source) return;
    const cut = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
    context.fillStyle = "#000";
    context.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    context.drawImage(
      source,
      point.x - cut / 2, point.y - cut / 2, cut, cut,
      0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE,
    );
    // Fadenkreuz
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(MAGNIFIER_SIZE / 2, 0);
    context.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
    context.moveTo(0, MAGNIFIER_SIZE / 2);
    context.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
    context.stroke();
    context.strokeStyle = "#dd9d88";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, 9, 0, Math.PI * 2);
    context.stroke();
  };

  const toImageCoords = (event: React.PointerEvent): Point | null => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !source) return null;
    return {
      x: Math.max(0, Math.min(source.width, ((event.clientX - rect.left) / rect.width) * source.width)),
      y: Math.max(0, Math.min(source.height, ((event.clientY - rect.top) / rect.height) * source.height)),
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const index = dragging.current;
    if (index === null || !quad) return;
    const point = toImageCoords(event);
    if (!point) return;
    const next = [...quad] as Quad;
    next[index] = point;
    setQuad(next);
    setMagnifier(point);
    drawMagnifier(point);
  };

  const confirm = async () => {
    if (!source || !quad) return;
    setBusy("cropping");
    try {
      // Kurz warten, damit der Browser den Ladezustand zeichnen kann.
      await new Promise((resolve) => setTimeout(resolve, 30));
      const cropped = warpQuad(source, quad);
      const blob = await canvasToBlob(cropped);
      if (!blob) {
        toast("Das Cover konnte nicht erzeugt werden.", "error");
        return;
      }

      setBusy("uploading");
      const body = new FormData();
      body.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        toast(data.error ?? "Upload fehlgeschlagen.", "error");
        return;
      }
      onCaptured(data.url);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const size = quad ? outputSize(quad) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cover aufnehmen"
      description="Foto machen – die App erkennt die Buchkanten und schneidet gerade zu."
      size="lg"
      footer={
        source ? (
          <>
            <Button variant="ghost" onClick={() => cameraRef.current?.click()} disabled={Boolean(busy)}>
              <RefreshCw size={16} />
              Neues Foto
            </Button>
            <Button onClick={confirm} disabled={Boolean(busy)}>
              {busy === "cropping" || busy === "uploading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {busy === "cropping" ? "Wird zugeschnitten …" : busy === "uploading" ? "Wird hochgeladen …" : "Übernehmen"}
            </Button>
          </>
        ) : null
      }
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(file);
          event.target.value = "";
        }}
      />

      {!source ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-paper-deep/70 text-ink-soft dark:bg-white/10">
            {busy === "reading" ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
          </span>
          <p className="max-w-sm text-sm text-ink-soft">
            Leg das Buch auf einen ruhigen Untergrund und fotografiere das Cover möglichst
            formatfüllend. Schiefe Aufnahmen werden automatisch geradegerückt.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => cameraRef.current?.click()} disabled={busy === "reading"}>
              <Camera size={16} />
              Foto aufnehmen
            </Button>
            <Button variant="soft" onClick={() => libraryRef.current?.click()} disabled={busy === "reading"}>
              <ImageUp size={16} />
              Bild auswählen
            </Button>
          </div>
          <p className="max-w-sm text-xs text-ink-faint">
            Auf dem iPhone kannst du auch die Dateien-App mit „Dokumente scannen“ nutzen und den
            fertigen Scan hier über „Bild auswählen“ übernehmen.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 py-1">
          <div
            ref={frameRef}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              dragging.current = null;
              setMagnifier(null);
            }}
            onPointerLeave={() => {
              dragging.current = null;
              setMagnifier(null);
            }}
            className="relative w-full touch-none-safe overflow-hidden rounded-2xl bg-black select-none"
            style={{ aspectRatio: `${source.width} / ${source.height}` }}
          >
            {preview ? (
              <img src={preview} alt="Aufgenommenes Cover" className="size-full object-contain" draggable={false} />
            ) : null}

            {quad ? (
              <svg
                viewBox={`0 0 ${source.width} ${source.height}`}
                className="absolute inset-0 size-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <mask id="cover-cut">
                    <rect width={source.width} height={source.height} fill="white" />
                    <polygon points={quad.map((p) => `${p.x},${p.y}`).join(" ")} fill="black" />
                  </mask>
                </defs>
                <rect width={source.width} height={source.height} fill="rgb(0 0 0 / 0.5)" mask="url(#cover-cut)" />
                <polygon
                  points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#dd9d88"
                  strokeWidth={Math.max(2, source.width / 260)}
                />
                {quad.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={Math.max(10, source.width / 46)}
                    fill="#dd9d88"
                    stroke="white"
                    strokeWidth={Math.max(2, source.width / 400)}
                    className="cursor-grab touch-none-safe active:cursor-grabbing"
                    role="button"
                    aria-label={`Ecke ${CORNER_LABELS[index]} verschieben`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      (event.target as SVGCircleElement).setPointerCapture?.(event.pointerId);
                      dragging.current = index;
                    }}
                  />
                ))}
              </svg>
            ) : null}

            {/* Lupe: erscheint beim Ziehen über der Ecke, damit der Finger die
                Stelle nicht verdeckt. */}
            <canvas
              ref={magnifierRef}
              width={MAGNIFIER_SIZE}
              height={MAGNIFIER_SIZE}
              className={cn(
                "pointer-events-none absolute z-10 rounded-full border-2 border-white/90 shadow-lift transition-opacity duration-150",
                magnifier ? "opacity-100" : "opacity-0",
              )}
              style={{
                width: MAGNIFIER_SIZE,
                height: MAGNIFIER_SIZE,
                left: magnifier && source ? `${(magnifier.x / source.width) * 100}%` : "50%",
                top: magnifier && source ? `${(magnifier.y / source.height) * 100}%` : "50%",
                transform:
                  magnifier && source && magnifier.y / source.height < 0.3
                    ? "translate(-50%, 24%)"
                    : "translate(-50%, -124%)",
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="soft"
              size="sm"
              onClick={() => source && setQuad(detectCoverQuad(source))}
              disabled={Boolean(busy)}
            >
              <ScanLine size={15} />
              Kanten neu erkennen
            </Button>
            <p className="text-xs text-ink-faint">
              Ecken auf die Buchkanten ziehen{size ? ` · Ergebnis ${size.width} × ${size.height} px` : ""}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
