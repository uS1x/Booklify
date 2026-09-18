"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp, Loader2, ScanBarcode, Zap, ZapOff } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { isbnFromBarcode } from "@/lib/isbn";
import { cn } from "@/lib/cn";

/* ── Minimaltypen für das (noch nicht in lib.dom enthaltene) BarcodeDetector-API ── */
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorInstance = { detect(source: ImageBitmapSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
};

/**
 * Eine Erkennungs-Engine: nativ (Android/Chrome, schnell und akkuschonend) oder
 * ZXing als Fallback für alle übrigen Browser. ZXing wird erst beim Öffnen des
 * Scanners nachgeladen und belastet das normale Laden der App nicht.
 */
type Engine = {
  kind: "native" | "zxing";
  scanVideo(video: HTMLVideoElement, stream: MediaStream, onText: (text: string) => void): Promise<() => void>;
  scanCanvas(canvas: HTMLCanvasElement): Promise<string[]>;
};

async function createEngine(): Promise<Engine> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      const formats = await Native.getSupportedFormats();
      if (formats.includes("ean_13")) {
        const detector = new Native({ formats: ["ean_13"] });
        return {
          kind: "native",
          async scanVideo(video, _stream, onText) {
            let active = true;
            const tick = async () => {
              if (!active) return;
              if (video.readyState >= 2) {
                try {
                  for (const code of await detector.detect(video)) onText(code.rawValue);
                } catch {
                  /* einzelner Frame nicht lesbar – weiter */
                }
              }
              if (active) setTimeout(tick, 120);
            };
            void tick();
            return () => {
              active = false;
            };
          },
          async scanCanvas(canvas) {
            return (await detector.detect(canvas)).map((code) => code.rawValue);
          },
        };
      }
    } catch {
      /* auf ZXing ausweichen */
    }
  }

  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map<unknown, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints as Map<never, never>, {
    delayBetweenScanAttempts: 90,
  });

  return {
    kind: "zxing",
    async scanVideo(video, stream, onText) {
      let stopped = false;
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (result && !stopped) onText(result.getText());
      });
      return () => {
        if (stopped) return;
        stopped = true;
        controls.stop();
      };
    },
    async scanCanvas(canvas) {
      try {
        return [reader.decodeFromCanvas(canvas).getText()];
      } catch {
        return [];
      }
    },
  };
}

/** Handyfotos sind riesig – für die Erkennung genügen ~1600 px Kantenlänge. */
async function fileToCanvas(file: File, maxEdge = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

type Status =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "no-camera"; message: string }
  | { kind: "reading-photo" };

export function IsbnScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (isbn: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const doneRef = useRef(false);
  // Aktuellen Callback merken, ohne dass ein neuer Callback die Kamera neu startet.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [hint, setHint] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });

  const stopCamera = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const handleText = useCallback(
    (text: string) => {
      if (doneRef.current) return;
      const check = isbnFromBarcode(text);
      if (check.ok) {
        doneRef.current = true;
        navigator.vibrate?.(60);
        stopCamera();
        onDetectedRef.current(check.isbn);
        return;
      }
      setHint(
        check.reason === "invalid"
          ? "Barcode unscharf gelesen – bitte ruhig halten."
          : "Das ist kein ISBN-Barcode. Buch-Barcodes beginnen mit 978 oder 979.",
      );
    },
    [stopCamera],
  );

  const getEngine = useCallback(async () => {
    engineRef.current ??= await createEngine();
    return engineRef.current;
  }, []);

  // Kamera starten, sobald der Dialog offen ist; beim Schließen alles freigeben.
  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    setHint(null);
    setTorch({ available: false, on: false });
    setStatus({ kind: "starting" });

    let cancelled = false;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: "no-camera",
          message:
            "Die Live-Kamera funktioniert nur über HTTPS (oder localhost). Mach stattdessen ein Foto vom Barcode.",
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        const capabilities = (track?.getCapabilities?.() ?? {}) as Record<string, unknown>;
        setTorch({ available: "torch" in capabilities, on: false });

        const engine = await getEngine();
        if (cancelled) return;
        const stopScan = await engine.scanVideo(video, stream, handleText);
        // Liegt der Barcode schon beim Start im Bild, meldet der erste Durchlauf
        // bereits einen Treffer, bevor die Stopp-Funktion zurückkommt – dann sofort
        // beenden, sonst liefe die Erkennung unsichtbar weiter.
        if (cancelled || doneRef.current) {
          stopScan();
          return;
        }
        stopScanRef.current = stopScan;
        setStatus({ kind: "scanning" });
      } catch (error) {
        const name = (error as DOMException)?.name;
        setStatus({
          kind: "no-camera",
          message:
            name === "NotAllowedError"
              ? "Kein Kamerazugriff erlaubt. Du kannst ihn in den Browser-Einstellungen freigeben – oder ein Foto verwenden."
              : name === "NotFoundError" || name === "OverconstrainedError"
                ? "Keine Kamera gefunden. Wähle ein Foto vom Barcode aus."
                : "Die Kamera konnte nicht gestartet werden. Verwende stattdessen ein Foto.",
        });
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, getEngine, handleText, stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch({ available: true, on: next });
    } catch {
      setTorch({ available: false, on: false });
    }
  };

  const readPhoto = async (file: File) => {
    const previous = status;
    setStatus({ kind: "reading-photo" });
    setHint(null);
    try {
      const engine = await getEngine();
      const canvas = await fileToCanvas(file);
      const texts = await engine.scanCanvas(canvas);
      if (!texts.length) {
        setHint("Auf dem Foto wurde kein Barcode gefunden. Nah heran, scharf und gerade fotografieren.");
      }
      for (const text of texts) handleText(text);
    } catch {
      setHint("Das Foto konnte nicht gelesen werden.");
    } finally {
      if (!doneRef.current) setStatus(previous.kind === "reading-photo" ? { kind: "scanning" } : previous);
    }
  };

  const cameraVisible = status.kind === "starting" || status.kind === "scanning" || status.kind === "reading-photo";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ISBN-Barcode scannen"
      description="Halte den Strichcode auf der Buchrückseite in den Rahmen."
      size="lg"
    >
      <div className="flex flex-col gap-4 py-1">
        {status.kind === "no-camera" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink/15 px-6 py-10 text-center dark:border-white/15">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-paper-deep/70 text-ink-soft dark:bg-white/10">
              <CameraOff size={22} />
            </span>
            <p className="max-w-sm text-sm text-ink-soft">{status.message}</p>
          </div>
        ) : null}

        <div
          className={cn(
            "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black sm:aspect-video",
            !cameraVisible && "hidden",
          )}
        >
          <video ref={videoRef} playsInline muted autoPlay className="size-full object-cover" />

          {/* Zielrahmen mit abgedunkelter Umgebung */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[38%] w-[78%] max-w-md rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]">
              {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
                "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
                "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
                "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"] as const).map((corner) => (
                <span key={corner} className={cn("absolute size-8 border-white/90", corner)} />
              ))}
              {status.kind === "scanning" ? (
                <span className="absolute inset-x-3 h-0.5 animate-[scanline_2.2s_ease-in-out_infinite] rounded-full bg-clay-300 shadow-[0_0_12px_2px_rgb(221_157_136/0.7)]" />
              ) : null}
            </div>
          </div>

          {status.kind === "starting" || status.kind === "reading-photo" ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-sm text-white">
              <Loader2 size={18} className="animate-spin" />
              {status.kind === "starting" ? "Kamera wird gestartet …" : "Foto wird gelesen …"}
            </div>
          ) : null}

          {torch.available ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torch.on ? "Licht ausschalten" : "Licht einschalten"}
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
            >
              {torch.on ? <ZapOff size={18} /> : <Zap size={18} />}
            </button>
          ) : null}
        </div>

        <p
          className={cn(
            "min-h-5 text-sm",
            hint ? "text-clay-600 dark:text-clay-300" : "text-ink-faint",
          )}
          role="status"
          aria-live="polite"
        >
          {hint ??
            (status.kind === "scanning"
              ? "Suche nach Barcode … Buch ruhig halten, bei wenig Licht die Lampe einschalten."
              : "")}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readPhoto(file);
              event.target.value = "";
            }}
          />
          <Button variant={status.kind === "no-camera" ? "primary" : "soft"} onClick={() => fileRef.current?.click()}>
            <ImageUp size={16} />
            Foto aufnehmen oder wählen
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-ink-faint">
            {status.kind === "scanning" ? <Camera size={13} /> : <ScanBarcode size={13} />}
            Lässt sich nichts lesen? Die ISBN einfach ins Suchfeld tippen.
          </span>
        </div>
      </div>
    </Modal>
  );
}
