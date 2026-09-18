"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { setReadingDatesAction } from "@/server/actions/books";
import { formatDate } from "@/lib/format";

const toInputDate = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

/** Start-, Enddatum und optionale Lesedauer. */
export function ReadingDates({
  userBookId,
  startedAt,
  finishedAt,
  readingMinutes,
}: {
  userBookId: string;
  startedAt: string | null;
  finishedAt: string | null;
  readingMinutes: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(toInputDate(startedAt));
  const [end, setEnd] = useState(toInputDate(finishedAt));
  const [minutes, setMinutes] = useState(readingMinutes ? String(readingMinutes) : "");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const days =
    startedAt && finishedAt
      ? Math.max(1, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 86400000))
      : null;

  const save = () =>
    startTransition(async () => {
      const result = await setReadingDatesAction(userBookId, {
        startedAt: start || null,
        finishedAt: end || null,
        readingMinutes: minutes ? Number(minutes) : null,
      });
      if (result.ok) {
        toast("Lesedaten gespeichert");
        setEditing(false);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Startdatum" optional>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Enddatum" optional>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Lesedauer (Min.)" optional>
            <Input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              inputMode="numeric"
              placeholder="z. B. 420"
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Speichern …" : "Speichern"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        <CalendarDays size={14} className="text-ink-faint" />
        {startedAt ? `begonnen ${formatDate(startedAt)}` : "Startdatum offen"}
      </span>
      {finishedAt ? (
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <CalendarDays size={14} className="text-ink-faint" />
          beendet {formatDate(finishedAt)}
        </span>
      ) : null}
      {days ? <span className="text-ink-faint">{days === 1 ? "an einem Tag" : `in ${days} Tagen`}</span> : null}
      {readingMinutes ? (
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <Clock size={14} className="text-ink-faint" />
          {Math.round(readingMinutes / 60)} h Lesezeit
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink"
      >
        <Pencil size={12} />
        anpassen
      </button>
    </div>
  );
}
