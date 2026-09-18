"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, Eraser, RotateCcw, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const WIDTH = 1000;
const HEIGHT = 700;

const COLORS = ["#2b2420", "#b9654c", "#e0a458", "#7e9a7b", "#6b8ca3", "#8c6b8e", "#e4a9a0", "#ffffff"];
const SIZES = [2, 5, 10, 22];

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; size: number; erase: boolean };

/**
 * Zeichenfläche mit Stift, Radierer, Strichstärke, Farben, Undo/Redo und
 * Speichern. Läuft über Pointer-Events und damit auch mit Finger und Stift.
 */
export function DrawingCanvas({
  onSave,
  saving,
  className,
}: {
  onSave: (dataUrl: string, size: { width: number; height: number }) => void;
  saving?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(5);
  const drawing = useRef<Stroke | null>(null);

  const redraw = useCallback((all: Stroke[], live?: Stroke | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of live ? [...all, live] : all) {
      ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      if (stroke.points.length === 1) {
        // Einzelner Tipp: als Punkt zeichnen.
        ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  useEffect(() => {
    redraw(strokes);
  }, [strokes, redraw]);

  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = {
      points: [toCanvasPoint(event)],
      color,
      size: tool === "eraser" ? size * 2.2 : size,
      erase: tool === "eraser",
    };
    redraw(strokes, drawing.current);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current.points.push(toCanvasPoint(event));
    redraw(strokes, drawing.current);
  };

  const end = () => {
    if (!drawing.current) return;
    const stroke = drawing.current;
    drawing.current = null;
    setStrokes((prev) => [...prev, stroke]);
    setRedoStack([]);
  };

  const undo = () => {
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((stack) => [...stack, last]);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const last = stack[stack.length - 1];
      setStrokes((prev) => [...prev, last]);
      return stack.slice(0, -1);
    });
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes.length) return;
    onSave(canvas.toDataURL("image/png"), { width: WIDTH, height: HEIGHT });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Werkzeuge */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/8 bg-surface p-2 dark:border-white/8">
        <div className="flex gap-1">
          <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="Stift">
            <Brush size={16} />
          </ToolButton>
          <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Radierer">
            <Eraser size={16} />
          </ToolButton>
        </div>

        <span className="mx-1 h-6 w-px bg-ink/10 dark:bg-white/10" />

        <div className="flex items-center gap-1.5">
          {SIZES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSize(value)}
              aria-label={`Strichstärke ${value}`}
              className={cn(
                "flex size-8 items-center justify-center rounded-xl transition-colors",
                size === value ? "bg-paper-deep dark:bg-white/15" : "hover:bg-ink/5 dark:hover:bg-white/8",
              )}
            >
              <span
                className="rounded-full bg-ink dark:bg-paper"
                style={{ width: Math.min(18, value + 2), height: Math.min(18, value + 2) }}
              />
            </button>
          ))}
        </div>

        <span className="mx-1 h-6 w-px bg-ink/10 dark:bg-white/10" />

        <div className="flex items-center gap-1.5">
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setColor(value);
                setTool("pen");
              }}
              aria-label={`Farbe ${value}`}
              className={cn(
                "size-7 rounded-full border-2 transition-transform",
                color === value && tool === "pen"
                  ? "scale-110 border-clay-500"
                  : "border-ink/10 hover:scale-105 dark:border-white/20",
              )}
              style={{ backgroundColor: value }}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ToolButton onClick={undo} disabled={!strokes.length} label="Rückgängig">
            <RotateCcw size={16} />
          </ToolButton>
          <ToolButton onClick={redo} disabled={!redoStack.length} label="Wiederholen">
            <RotateCw size={16} />
          </ToolButton>
          <ToolButton
            onClick={() => {
              setStrokes([]);
              setRedoStack([]);
            }}
            disabled={!strokes.length}
            label="Alles löschen"
          >
            <Trash2 size={16} />
          </ToolButton>
        </div>
      </div>

      {/* Zeichenfläche */}
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft dark:border-white/10">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          className="touch-none-safe block w-full cursor-crosshair"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">
          {strokes.length ? `${strokes.length} Striche` : "Zeichne mit Maus, Finger oder Stift."}
        </p>
        <Button onClick={save} disabled={!strokes.length || saving}>
          {saving ? "Speichern …" : "Zeichnung speichern"}
        </Button>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-xl transition-colors disabled:opacity-40",
        active
          ? "bg-ink text-paper dark:bg-clay-400 dark:text-ink"
          : "text-ink-soft hover:bg-ink/5 dark:hover:bg-white/8",
      )}
    >
      {children}
    </button>
  );
}
