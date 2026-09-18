"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { updateProgressAction } from "@/server/actions/books";
import { formatNumber, progressPercent } from "@/lib/format";

/** Dialog für „Ich bin jetzt auf Seite …“. */
export function ProgressDialog({
  open,
  onClose,
  userBookId,
  title,
  pageCount,
  currentPage,
}: {
  open: boolean;
  onClose: () => void;
  userBookId: string;
  title: string;
  pageCount?: number | null;
  currentPage: number;
}) {
  const [page, setPage] = useState(currentPage);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setPage(currentPage);
      setNote("");
    }
  }, [open, currentPage]);

  const max = pageCount ?? 9999;
  const pct = progressPercent(page, pageCount);
  const finished = Boolean(pageCount) && page >= (pageCount ?? 0);

  const save = () =>
    startTransition(async () => {
      const result = await updateProgressAction(userBookId, page, note);
      if (result.ok) {
        toast(finished ? "Geschafft – als gelesen markiert 🎉" : `Seite ${formatNumber(page)} gespeichert`);
        router.refresh();
        onClose();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lesefortschritt"
      description={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Speichern …" : "Speichern"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 py-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-ink-soft">
              Seite{" "}
              <span className="font-semibold text-ink tabular-nums">{formatNumber(page)}</span>
              {pageCount ? <span className="text-ink-faint"> / {formatNumber(pageCount)}</span> : null}
            </span>
            <span className="text-sm font-semibold text-clay-600 tabular-nums dark:text-clay-300">{pct} %</span>
          </div>
          <ProgressBar value={pct} height="h-2.5" />
        </div>

        {pageCount ? (
          <input
            type="range"
            min={0}
            max={max}
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
            aria-label="Aktuelle Seite"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink/10 accent-clay-500 dark:bg-white/15"
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Aktuelle Seite">
            <Input
              type="number"
              min={0}
              max={max}
              value={page}
              onChange={(e) => setPage(Math.max(0, Math.min(max, Number(e.target.value))))}
              inputMode="numeric"
            />
          </Field>
          <div className="flex items-end gap-2">
            {[10, 25, 50].map((step) => (
              <Button
                key={step}
                type="button"
                variant="soft"
                size="sm"
                onClick={() => setPage((p) => Math.min(max, p + step))}
              >
                +{step}
              </Button>
            ))}
          </div>
        </div>

        <Field label="Notiz zur Leserunde" optional>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Was ist passiert? Wie war’s?"
            rows={2}
          />
        </Field>

        {finished ? (
          <p className="rounded-xl bg-sage-100 px-3.5 py-2.5 text-sm text-sage-500 dark:bg-sage-500/15 dark:text-sage-200">
            Mit dieser Seite ist das Buch durch – wir markieren es als gelesen.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
