"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react";

import { QuestionInput } from "@/components/questions/question-input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { saveAnswersAction } from "@/server/actions/answers";
import { cn } from "@/lib/cn";
import type { AnswerDTO, QuestionDTO } from "@/server/queries/questions";

type Group = {
  key: string;
  label: string;
  emoji: string | null;
  questions: QuestionDTO[];
};

/**
 * Mehrstufiger Fragebogen. Die Gruppen entstehen aus den Genres des Buches –
 * es gibt keine fest programmierten Genre-Komponenten.
 */
export function QuestionnaireForm({
  userBookId,
  bookTitle,
  questions,
  existing,
}: {
  userBookId: string;
  bookTitle: string;
  questions: QuestionDTO[];
  existing: AnswerDTO[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const answer of existing) if (!answer.skipped) initial[answer.questionId] = answer.value;
    return initial;
  });
  const [skipped, setSkipped] = useState<Set<string>>(
    () => new Set(existing.filter((a) => a.skipped).map((a) => a.questionId)),
  );

  const groups = useMemo<Group[]>(() => {
    const general = questions.filter((q) => q.scope === "GENERAL");
    const byGenre = new Map<string, Group>();
    for (const question of questions) {
      if (question.scope !== "GENRE" || !question.genre) continue;
      const key = question.genre.slug;
      const group = byGenre.get(key) ?? {
        key,
        label: question.genre.name,
        emoji: question.genre.emoji,
        questions: [],
      };
      group.questions.push(question);
      byGenre.set(key, group);
    }
    return [
      ...(general.length ? [{ key: "general", label: "Allgemein", emoji: "📖", questions: general }] : []),
      ...byGenre.values(),
    ];
  }, [questions]);

  const [step, setStep] = useState(0);
  const group = groups[step];
  const answeredCount = questions.filter((q) => values[q.id] !== undefined && values[q.id] !== null).length;
  const percent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const payload = () =>
    questions
      .filter((q) => values[q.id] !== undefined || skipped.has(q.id))
      .map((q) => ({
        questionId: q.id,
        value: values[q.id] ?? null,
        skipped: skipped.has(q.id) || values[q.id] === null || values[q.id] === undefined,
      }));

  const persist = (then?: () => void) =>
    startTransition(async () => {
      const result = await saveAnswersAction(userBookId, payload());
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      then?.();
    });

  const finish = () =>
    persist(() => {
      toast("Fragebogen gespeichert");
      router.push(`/books/${userBookId}`);
      router.refresh();
    });

  if (!group) {
    return <p className="text-sm text-ink-faint">Für dieses Buch sind keine Fragen hinterlegt.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Fortschritt & Gruppenreiter */}
      <div>
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-ink-faint">
            {answeredCount} von {questions.length} Fragen beantwortet
          </span>
          <span className="font-semibold text-ink tabular-nums">{percent} %</span>
        </div>
        <ProgressBar value={percent} />
        <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {groups.map((entry, index) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => persist(() => setStep(index))}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                index === step
                  ? "border-transparent bg-ink text-paper dark:bg-clay-400 dark:text-ink"
                  : "border-ink/10 text-ink-soft hover:border-ink/25 dark:border-white/12",
              )}
            >
              {entry.emoji} {entry.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={group.key}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-ink-faint">
            {group.key === "general"
              ? `Allgemeine Fragen zu „${bookTitle}“`
              : `Fragen für ${group.label}`}{" "}
            · jede Frage ist freiwillig
          </p>

          {group.questions.map((question) => {
            const isSkipped = skipped.has(question.id);
            const hasValue = values[question.id] !== undefined && values[question.id] !== null;
            return (
              <div
                key={question.id}
                className={cn(
                  "rounded-2xl border bg-surface p-4 transition-colors sm:p-5",
                  isSkipped
                    ? "border-dashed border-ink/12 opacity-60 dark:border-white/12"
                    : hasValue
                      ? "border-clay-200 dark:border-clay-400/30"
                      : "border-ink/8 dark:border-white/8",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base leading-snug text-ink">{question.prompt}</h3>
                    {question.hint ? <p className="mt-0.5 text-xs text-ink-faint">{question.hint}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSkipped((prev) => {
                        const next = new Set(prev);
                        if (next.has(question.id)) next.delete(question.id);
                        else {
                          next.add(question.id);
                          setValues((v) => ({ ...v, [question.id]: null }));
                        }
                        return next;
                      });
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors",
                      isSkipped
                        ? "bg-paper-deep/70 text-ink dark:bg-white/10"
                        : "text-ink-faint hover:bg-ink/5 dark:hover:bg-white/10",
                    )}
                  >
                    <SkipForward size={12} />
                    {isSkipped ? "übersprungen" : "überspringen"}
                  </button>
                </div>

                {!isSkipped ? (
                  <QuestionInput
                    question={question}
                    value={values[question.id]}
                    onChange={(value) =>
                      setValues((prev) => ({ ...prev, [question.id]: value }))
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-20 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/8 bg-surface/95 p-3 shadow-lift backdrop-blur-xl lg:bottom-4 dark:border-white/8">
        <Button
          variant="ghost"
          disabled={step === 0 || pending}
          onClick={() => persist(() => setStep((s) => Math.max(0, s - 1)))}
        >
          <ArrowLeft size={16} />
          Zurück
        </Button>

        <span className="hidden text-xs text-ink-faint sm:block">
          Abschnitt {step + 1} von {groups.length}
        </span>

        <div className="ml-auto flex gap-2">
          <Button variant="soft" disabled={pending} onClick={() => persist(() => toast("Zwischenstand gespeichert"))}>
            Speichern
          </Button>
          {step < groups.length - 1 ? (
            <Button disabled={pending} onClick={() => persist(() => setStep((s) => s + 1))}>
              Weiter
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button disabled={pending} onClick={finish}>
              <Check size={16} />
              {pending ? "Speichern …" : "Fertig"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
