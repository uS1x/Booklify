"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BookCover } from "@/components/ui/book-cover";
import { CoverCapture } from "@/components/books/cover-capture";
import { useToast } from "@/components/ui/toast";
import { updateBookAction } from "@/server/actions/books";
import { LANGUAGES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { ShelfBook } from "@/server/queries/books";

export type GenreOption = { slug: string; name: string; emoji: string | null };

/** Alle automatisch übernommenen Angaben bleiben jederzeit bearbeitbar. */
export function EditBookDialog({
  open,
  onClose,
  book,
  genres,
}: {
  open: boolean;
  onClose: () => void;
  book: ShelfBook;
  genres: GenreOption[];
}) {
  const [form, setForm] = useState({
    title: book.title,
    subtitle: book.subtitle ?? "",
    author: book.author,
    coverUrl: book.bookCoverUrl ?? "",
    description: book.description ?? "",
    isbn13: book.isbn ?? "",
    publishedYear: book.publishedYear ? String(book.publishedYear) : "",
    publisher: book.publisher ?? "",
    pageCount: book.pageCount ? String(book.pageCount) : "",
    language: book.language ?? "de",
  });
  const [selectedGenres, setSelectedGenres] = useState<string[]>(book.genres.map((g) => g.slug));
  /** Eigenes Cover-Foto dieses Exemplars – unabhängig vom Cover des Werks. */
  const [ownCover, setOwnCover] = useState<string | null>(book.coverOverride);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const result = await updateBookAction(book.id, {
        book: {
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          author: form.author.trim(),
          coverUrl: form.coverUrl.trim() || null,
          description: form.description.trim() || null,
          isbn13: form.isbn13.trim() || null,
          publishedYear: form.publishedYear ? Number(form.publishedYear) : null,
          publisher: form.publisher.trim() || null,
          pageCount: form.pageCount ? Number(form.pageCount) : null,
          language: form.language || null,
          genreSlugs: selectedGenres,
        },
        copy: { coverOverride: ownCover },
      });
      if (result.ok) {
        toast("Buch aktualisiert");
        onClose();
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buch bearbeiten"
      description="Alle Angaben lassen sich frei anpassen."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={pending || !form.title.trim() || !form.author.trim()}>
            {pending ? "Speichern …" : "Speichern"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="flex gap-4">
          <div className="h-32 w-22 shrink-0 shadow-book">
            <BookCover
              title={form.title || "Titel"}
              author={form.author}
              coverUrl={ownCover ?? form.coverUrl ?? null}
              textScale={0.7}
            />
          </div>
          <div className="flex-1">
            <Field label="Cover-URL" optional hint="Leer lassen für ein gestaltetes Farbcover.">
              <Input
                value={form.coverUrl}
                onChange={(e) => set("coverUrl")(e.target.value)}
                placeholder="https://…"
                disabled={Boolean(ownCover)}
              />
            </Field>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="soft" size="sm" onClick={() => setCaptureOpen(true)}>
                <Camera size={15} />
                {ownCover ? "Neu aufnehmen" : "Cover aufnehmen"}
              </Button>
              {ownCover ? (
                <button
                  type="button"
                  onClick={() => setOwnCover(null)}
                  className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink"
                >
                  eigenes Foto entfernen
                </button>
              ) : null}
            </div>
            {ownCover ? (
              <p className="mt-1.5 text-[11px] text-ink-faint">
                Dein eigenes Foto gilt nur für dein Exemplar.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titel">
            <Input value={form.title} onChange={(e) => set("title")(e.target.value)} required />
          </Field>
          <Field label="Untertitel" optional>
            <Input value={form.subtitle} onChange={(e) => set("subtitle")(e.target.value)} />
          </Field>
          <Field label="Autor">
            <Input value={form.author} onChange={(e) => set("author")(e.target.value)} required />
          </Field>
          <Field label="Verlag" optional>
            <Input value={form.publisher} onChange={(e) => set("publisher")(e.target.value)} />
          </Field>
          <Field label="Seitenzahl" optional>
            <Input
              type="number"
              min={1}
              value={form.pageCount}
              onChange={(e) => set("pageCount")(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Veröffentlichungsjahr" optional>
            <Input
              type="number"
              min={0}
              max={2200}
              value={form.publishedYear}
              onChange={(e) => set("publishedYear")(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="ISBN" optional>
            <Input value={form.isbn13} onChange={(e) => set("isbn13")(e.target.value)} placeholder="978…" />
          </Field>
          <Field label="Sprache" optional>
            <Select value={form.language} onChange={(e) => set("language")(e.target.value)}>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Genres" hint="Bestimmt auch, welche Fragen im Fragebogen erscheinen.">
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => {
              const active = selectedGenres.includes(genre.slug);
              return (
                <button
                  key={genre.slug}
                  type="button"
                  onClick={() =>
                    setSelectedGenres((prev) =>
                      prev.includes(genre.slug)
                        ? prev.filter((g) => g !== genre.slug)
                        : [...prev, genre.slug].slice(0, 6),
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-transparent bg-clay-500 text-white"
                      : "border-ink/12 text-ink-soft hover:border-clay-300 dark:border-white/12",
                  )}
                >
                  {genre.emoji} {genre.name}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Beschreibung" optional>
          <Textarea value={form.description} onChange={(e) => set("description")(e.target.value)} rows={5} />
        </Field>
      </div>

      <CoverCapture open={captureOpen} onClose={() => setCaptureOpen(false)} onCaptured={setOwnCover} />
    </Modal>
  );
}
