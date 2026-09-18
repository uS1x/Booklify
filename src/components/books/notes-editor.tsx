"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";

import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveNotesAction } from "@/server/actions/books";

/** Persönliche Notizen – das Buch-Tagebuch zum Exemplar. */
export function NotesEditor({ userBookId, notes }: { userBookId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const save = () =>
    startTransition(async () => {
      const result = await saveNotesAction(userBookId, value);
      if (result.ok) {
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 2200);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  if (!editing) {
    return (
      <div className="group relative">
        {value ? (
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{value}</p>
        ) : (
          <p className="text-sm text-ink-faint italic">Noch keine Notizen.</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
        >
          <Pencil size={12} />
          {value ? "bearbeiten" : "Notiz schreiben"}
        </button>
        {saved ? (
          <span className="ml-3 inline-flex items-center gap-1 text-xs text-sage-500">
            <Check size={12} />
            gespeichert
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        autoFocus
        placeholder="Was möchtest du über dieses Buch festhalten? Lieblingsstellen, Gedanken, Stimmung …"
        className="font-[family-name:var(--font-hand)] text-base leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Speichern …" : "Speichern"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(notes ?? "");
            setEditing(false);
          }}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
