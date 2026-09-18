"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Search, Upload } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export type PickedImage = {
  url: string;
  width?: number;
  height?: number;
  credit?: { author?: string | null; source?: string | null; url?: string | null } | null;
};

type StockImage = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  description: string | null;
  authorName: string | null;
  authorUrl: string | null;
  sourceName: string;
};

/**
 * Bilder fürs Moodboard: Suche über den konfigurierten Anbieter plus Upload
 * eigener Dateien. Ohne API-Key bleibt der Upload-Weg vollständig nutzbar.
 */
export function ImagePicker({
  open,
  onClose,
  onPick,
  providerLabel,
  providerConfigured,
  providerHint,
  suggestion,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (image: PickedImage) => void;
  providerLabel: string;
  providerConfigured: boolean;
  providerHint: string;
  suggestion?: string;
}) {
  const [query, setQuery] = useState(suggestion ?? "");
  const [results, setResults] = useState<StockImage[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, startLoading] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const search = () => {
    if (!query.trim()) return;
    startLoading(async () => {
      try {
        const response = await fetch(`/api/images/search?q=${encodeURIComponent(query)}`);
        const data = (await response.json()) as { results?: StockImage[] };
        setResults(data.results ?? []);
        setSearched(true);
      } catch {
        toast("Bildsuche gerade nicht erreichbar.", "error");
      }
    });
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        toast(data.error ?? "Upload fehlgeschlagen.", "error");
        return;
      }
      onPick({ url: data.url });
      onClose();
    } catch {
      toast("Upload fehlgeschlagen.", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bild hinzufügen" size="xl">
      <div className="flex flex-col gap-5 py-1">
        {/* Upload */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-ink/15 p-4 dark:border-white/15">
          <span className="flex size-10 items-center justify-center rounded-xl bg-paper-deep/60 text-ink-soft dark:bg-white/8">
            <Upload size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Eigenes Bild hochladen</p>
            <p className="text-xs text-ink-faint">JPEG, PNG, WebP, GIF oder AVIF · max. 6 MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <Button variant="soft" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {uploading ? "Lädt …" : "Datei wählen"}
          </Button>
        </div>

        {/* Suche */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink">Bildsuche</p>
            <span className="text-xs text-ink-faint">{providerLabel}</span>
          </div>

          {providerConfigured ? (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  search();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="z. B. romantic sunset aesthetic"
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={loading || query.trim().length < 2}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Suchen"}
                </Button>
              </form>

              {results.length ? (
                <div className="mt-4 grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                  {results.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => {
                        onPick({
                          url: image.fullUrl,
                          width: image.width,
                          height: image.height,
                          credit: {
                            author: image.authorName,
                            source: image.sourceName,
                            url: image.authorUrl,
                          },
                        });
                        onClose();
                      }}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-ink/8 dark:border-white/8"
                    >
                      <img
                        src={image.thumbUrl}
                        alt={image.description ?? "Vorschlag"}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {image.authorName ? (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-ink/60 px-2 py-1 text-[10px] text-paper opacity-0 transition-opacity group-hover:opacity-100">
                          {image.authorName} · {image.sourceName}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : searched && !loading ? (
                <p className="mt-4 text-sm text-ink-faint">Keine Bilder gefunden. Andere Begriffe probieren?</p>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl bg-paper-soft/80 p-4 text-sm text-ink-soft dark:bg-white/5">
              <p>
                Die Bildsuche ist noch nicht eingerichtet. Sobald ein Anbieter konfiguriert ist
                (Unsplash oder Pexels), kannst du hier direkt nach Stimmungsbildern suchen.
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                Einrichtung: <code className="rounded bg-ink/8 px-1.5 py-0.5">{providerHint}</code> · Upload,
                Farbflächen, Notizen und Zeichnungen funktionieren unabhängig davon.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
