"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BookPlus, Check, Loader2, PencilLine, Search, Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { BookCover } from "@/components/ui/book-cover";
import { useToast } from "@/components/ui/toast";
import { createBookAction } from "@/server/actions/books";
import { LANGUAGES, READING_STATUSES, READING_STATUS_META, VISIBILITY_META } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { GenreOption } from "@/components/books/edit-book-dialog";

type Candidate = {
  source: string;
  externalId: string;
  title: string;
  subtitle?: string | null;
  author: string;
  coverUrl?: string | null;
  description?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publishedYear?: number | null;
  publisher?: string | null;
  pageCount?: number | null;
  language?: string | null;
  genreSlugs: string[];
  subjects: string[];
};

type SearchField = "any" | "title" | "author" | "isbn";

const emptyDetails = {
  title: "",
  subtitle: "",
  author: "",
  coverUrl: "",
  description: "",
  isbn13: "",
  publishedYear: "",
  publisher: "",
  pageCount: "",
  language: "de",
};

/** Dreistufiger Wizard: suchen → Angaben prüfen → eigenes Exemplar einrichten. */
export function AddBookWizard({
  genres,
  provider,
}: {
  genres: GenreOption[];
  provider: { id: string; label: string; configured: boolean };
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [field, setField] = useState<SearchField>("any");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, startSearch] = useTransition();

  const [details, setDetails] = useState(emptyDetails);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [external, setExternal] = useState<{ source: string | null; id: string | null }>({ source: null, id: null });

  const [copy, setCopy] = useState({
    status: "WANT_TO_READ" as (typeof READING_STATUSES)[number],
    currentPage: "",
    rating: "",
    notes: "",
    tags: "",
    visibility: "PRIVATE" as "PRIVATE" | "FRIENDS",
    lendingEnabled: false,
    favorite: false,
  });

  const [saving, startSaving] = useTransition();

  const search = () => {
    if (query.trim().length < 2) return;
    startSearch(async () => {
      try {
        const response = await fetch(
          `/api/books/search?q=${encodeURIComponent(query.trim())}&field=${field}`,
        );
        const data = (await response.json()) as { results?: Candidate[] };
        setResults(data.results ?? []);
        setSearched(true);
      } catch {
        toast("Die Buchsuche ist gerade nicht erreichbar – du kannst das Buch manuell anlegen.", "error");
        setSearched(true);
      }
    });
  };

  const pick = (candidate: Candidate) => {
    setDetails({
      title: candidate.title,
      subtitle: candidate.subtitle ?? "",
      author: candidate.author,
      coverUrl: candidate.coverUrl ?? "",
      description: candidate.description ?? "",
      isbn13: candidate.isbn13 ?? candidate.isbn10 ?? "",
      publishedYear: candidate.publishedYear ? String(candidate.publishedYear) : "",
      publisher: candidate.publisher ?? "",
      pageCount: candidate.pageCount ? String(candidate.pageCount) : "",
      language: candidate.language ?? "de",
    });
    setSelectedGenres(candidate.genreSlugs.filter((slug) => genres.some((g) => g.slug === slug)));
    setExternal({ source: candidate.source, id: candidate.externalId });
    setStep(1);
  };

  const startManual = () => {
    setDetails({ ...emptyDetails, title: query.trim() });
    setSelectedGenres([]);
    setExternal({ source: "manual", id: null });
    setStep(1);
  };

  const save = () =>
    startSaving(async () => {
      const result = await createBookAction({
        book: {
          title: details.title.trim(),
          subtitle: details.subtitle.trim() || null,
          author: details.author.trim() || "Unbekannt",
          coverUrl: details.coverUrl.trim() || null,
          description: details.description.trim() || null,
          isbn13: details.isbn13.trim() || null,
          publishedYear: details.publishedYear ? Number(details.publishedYear) : null,
          publisher: details.publisher.trim() || null,
          pageCount: details.pageCount ? Number(details.pageCount) : null,
          language: details.language || null,
          genreSlugs: selectedGenres,
          externalSource: external.source,
          externalId: external.id,
        },
        copy: {
          status: copy.status,
          currentPage: copy.currentPage ? Number(copy.currentPage) : 0,
          rating: copy.rating ? Number(copy.rating) : null,
          notes: copy.notes.trim() || null,
          tags: copy.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          visibility: copy.visibility,
          lendingEnabled: copy.lendingEnabled,
          favorite: copy.favorite,
        },
      });

      if (!result.ok) {
        toast(result.error, "error");
        return;
      }

      toast(`„${details.title}“ steht jetzt im Regal`);
      router.push(
        copy.status === "READ"
          ? `/books/${result.data.userBookId}/questionnaire`
          : `/books/${result.data.userBookId}`,
      );
      router.refresh();
    });

  const steps = ["Buch finden", "Angaben prüfen", "Mein Exemplar"];

  return (
    <div className="flex flex-col gap-6">
      {/* Schrittanzeige */}
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                index < step
                  ? "bg-sage-400 text-white"
                  : index === step
                    ? "bg-ink text-paper dark:bg-clay-400 dark:text-ink"
                    : "bg-paper-deep/70 text-ink-faint dark:bg-white/10",
              )}
            >
              {index < step ? <Check size={14} /> : index + 1}
            </span>
            <span className={cn(index === step ? "text-ink" : "text-ink-faint")}>{label}</span>
            {index < steps.length - 1 ? <span className="text-ink-faint">·</span> : null}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {/* ── Schritt 1: Suche ───────────────────────────────────────── */}
        {step === 0 ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-3xl border border-ink/8 bg-surface p-5 shadow-soft sm:p-6 dark:border-white/8">
              <Segmented
                id="search-field"
                value={field}
                onChange={setField}
                size="sm"
                options={[
                  { value: "any", label: "Alles" },
                  { value: "title", label: "Titel" },
                  { value: "author", label: "Autor" },
                  { value: "isbn", label: "ISBN" },
                ]}
              />

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  search();
                }}
                className="mt-4 flex gap-2"
              >
                <div className="relative flex-1">
                  <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      field === "isbn"
                        ? "978-3-551-55167-9"
                        : field === "author"
                          ? "Patrick Rothfuss"
                          : "Der Name des Windes"
                    }
                    className="h-12 pl-11"
                    autoFocus
                  />
                </div>
                <Button type="submit" size="lg" disabled={searching || query.trim().length < 2}>
                  {searching ? <Loader2 size={17} className="animate-spin" /> : "Suchen"}
                </Button>
              </form>

              <p className="mt-3 text-xs text-ink-faint">
                {provider.configured
                  ? `Metadaten von ${provider.label} – alle Angaben bleiben danach bearbeitbar.`
                  : "Es ist keine Buch-API konfiguriert. Du kannst Bücher vollständig manuell anlegen."}
              </p>
            </div>

            {results.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((candidate) => (
                  <button
                    key={`${candidate.source}-${candidate.externalId}-${candidate.title}`}
                    type="button"
                    onClick={() => pick(candidate)}
                    className="group flex gap-3 rounded-2xl border border-ink/8 bg-surface p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-clay-200 hover:shadow-lift dark:border-white/8"
                  >
                    <div className="h-28 w-19 shrink-0 shadow-book">
                      <BookCover
                        title={candidate.title}
                        author={candidate.author}
                        coverUrl={candidate.coverUrl}
                        textScale={0.55}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm leading-snug font-medium text-ink">{candidate.title}</h3>
                      <p className="mt-0.5 truncate text-xs text-ink-faint">{candidate.author}</p>
                      <p className="mt-1.5 text-[11px] text-ink-faint">
                        {[
                          candidate.publishedYear,
                          candidate.pageCount ? `${candidate.pageCount} S.` : null,
                          candidate.publisher,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-clay-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-clay-300">
                        übernehmen <ArrowRight size={11} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {searched && !results.length && !searching ? (
              <p className="text-sm text-ink-faint">
                Keine Treffer. Vielleicht ein Tippfehler – oder das Buch ist zu selten. Leg es einfach manuell an.
              </p>
            ) : null}

            <button
              type="button"
              onClick={startManual}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/15 px-4 py-4 text-sm text-ink-soft transition-colors hover:border-clay-300 hover:text-ink dark:border-white/15"
            >
              <PencilLine size={16} />
              Buch manuell anlegen
            </button>
          </motion.div>
        ) : null}

        {/* ── Schritt 2: Angaben ────────────────────────────────────── */}
        {step === 1 ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-3xl border border-ink/8 bg-surface p-5 shadow-soft sm:p-6 dark:border-white/8">
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="mx-auto w-32 shrink-0 sm:mx-0">
                  <div className="aspect-2/3 shadow-book">
                    <BookCover
                      title={details.title || "Titel"}
                      author={details.author}
                      coverUrl={details.coverUrl || null}
                      textScale={1}
                    />
                  </div>
                  <Field label="Cover-URL" optional className="mt-3">
                    <Input
                      value={details.coverUrl}
                      onChange={(event) => setDetails({ ...details, coverUrl: event.target.value })}
                      placeholder="https://…"
                      className="text-xs"
                    />
                  </Field>
                </div>

                <div className="grid flex-1 gap-4 sm:grid-cols-2">
                  <Field label="Titel" className="sm:col-span-2">
                    <Input
                      value={details.title}
                      onChange={(event) => setDetails({ ...details, title: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Autor">
                    <Input
                      value={details.author}
                      onChange={(event) => setDetails({ ...details, author: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Verlag" optional>
                    <Input
                      value={details.publisher}
                      onChange={(event) => setDetails({ ...details, publisher: event.target.value })}
                    />
                  </Field>
                  <Field label="Seitenzahl" optional hint="Grundlage für den Lesefortschritt.">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={details.pageCount}
                      onChange={(event) => setDetails({ ...details, pageCount: event.target.value })}
                    />
                  </Field>
                  <Field label="Erscheinungsjahr" optional>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={details.publishedYear}
                      onChange={(event) => setDetails({ ...details, publishedYear: event.target.value })}
                    />
                  </Field>
                  <Field label="ISBN" optional>
                    <Input
                      value={details.isbn13}
                      onChange={(event) => setDetails({ ...details, isbn13: event.target.value })}
                    />
                  </Field>
                  <Field label="Sprache" optional>
                    <Select
                      value={details.language}
                      onChange={(event) => setDetails({ ...details, language: event.target.value })}
                    >
                      {LANGUAGES.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>

              <Field
                label="Genres"
                hint="Bestimmt die genreabhängigen Fragen im Fragebogen."
                className="mt-5"
              >
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
                              ? prev.filter((slug) => slug !== genre.slug)
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

              <Field label="Beschreibung" optional className="mt-4">
                <Textarea
                  value={details.description}
                  onChange={(event) => setDetails({ ...details, description: event.target.value })}
                  rows={4}
                />
              </Field>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft size={16} />
                Zurück zur Suche
              </Button>
              <Button onClick={() => setStep(2)} disabled={!details.title.trim()}>
                Weiter
                <ArrowRight size={16} />
              </Button>
            </div>
          </motion.div>
        ) : null}

        {/* ── Schritt 3: Exemplar ───────────────────────────────────── */}
        {step === 2 ? (
          <motion.div
            key="copy"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-3xl border border-ink/8 bg-surface p-5 shadow-soft sm:p-6 dark:border-white/8">
              <Field label="Lesestatus">
                <div className="flex flex-wrap gap-1.5">
                  {READING_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setCopy({ ...copy, status })}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm transition-colors",
                        copy.status === status
                          ? "border-transparent bg-ink text-paper dark:bg-clay-400 dark:text-ink"
                          : "border-ink/12 text-ink-soft hover:border-clay-300 dark:border-white/12",
                      )}
                    >
                      {READING_STATUS_META[status].emoji} {READING_STATUS_META[status].label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {copy.status === "READING" || copy.status === "ABANDONED" ? (
                  <Field label="Aktuelle Seite" optional>
                    <Input
                      type="number"
                      min={0}
                      max={details.pageCount ? Number(details.pageCount) : undefined}
                      inputMode="numeric"
                      value={copy.currentPage}
                      onChange={(event) => setCopy({ ...copy, currentPage: event.target.value })}
                      placeholder={details.pageCount ? `0 – ${details.pageCount}` : "Seite"}
                    />
                  </Field>
                ) : null}

                {copy.status === "READ" || copy.status === "ABANDONED" ? (
                  <Field label="Bewertung (1–10)" optional>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      inputMode="numeric"
                      value={copy.rating}
                      onChange={(event) => setCopy({ ...copy, rating: event.target.value })}
                    />
                  </Field>
                ) : null}

                <Field label="Tags" optional hint="Mit Komma trennen." className="sm:col-span-2">
                  <Input
                    value={copy.tags}
                    onChange={(event) => setCopy({ ...copy, tags: event.target.value })}
                    placeholder="cozy, Urlaub, Buchclub"
                  />
                </Field>

                <Field label="Erste Notiz" optional className="sm:col-span-2">
                  <Textarea
                    value={copy.notes}
                    onChange={(event) => setCopy({ ...copy, notes: event.target.value })}
                    rows={3}
                    placeholder="Warum dieses Buch? Von wem empfohlen?"
                  />
                </Field>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-ink/8 pt-5 dark:border-white/8">
                <Field label="Sichtbarkeit">
                  <Segmented
                    id="wizard-visibility"
                    value={copy.visibility}
                    onChange={(visibility) =>
                      setCopy({
                        ...copy,
                        visibility,
                        lendingEnabled: visibility === "PRIVATE" ? false : copy.lendingEnabled,
                      })
                    }
                    size="sm"
                    options={[
                      { value: "PRIVATE", label: "Privat" },
                      { value: "FRIENDS", label: "Mit Freunden geteilt" },
                    ]}
                  />
                  <p className="mt-2 text-xs text-ink-faint">{VISIBILITY_META[copy.visibility].hint}</p>
                </Field>

                <Switch
                  checked={copy.lendingEnabled}
                  disabled={copy.visibility === "PRIVATE"}
                  onChange={(lendingEnabled) => setCopy({ ...copy, lendingEnabled })}
                  label="Ausleihen erlauben"
                  hint={
                    copy.visibility === "PRIVATE"
                      ? "Nur möglich, wenn das Buch geteilt ist."
                      : "Freunde dürfen Ausleihanfragen stellen."
                  }
                />

                <Switch
                  checked={copy.favorite}
                  onChange={(favorite) => setCopy({ ...copy, favorite })}
                  label="Als Favorit markieren"
                  hint="Erscheint im Regal mit einem Stern."
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={16} />
                Angaben
              </Button>
              <Button size="lg" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : copy.status === "READ" ? (
                  <Sparkles size={17} />
                ) : (
                  <BookPlus size={17} />
                )}
                {saving
                  ? "Wird eingestellt …"
                  : copy.status === "READ"
                    ? "Ins Regal & Fragebogen"
                    : "Ins Regal stellen"}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
