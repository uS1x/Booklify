"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandHeart, Lock, Users } from "lucide-react";

import { Switch } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { setSharingAction } from "@/server/actions/books";
import { VISIBILITY_META, type Visibility } from "@/lib/constants";

/** Datenschutz-Schalter pro Exemplar: Sichtbarkeit und Ausleiherlaubnis. */
export function SharingControls({
  userBookId,
  visibility,
  lendingEnabled,
}: {
  userBookId: string;
  visibility: Visibility;
  lendingEnabled: boolean;
}) {
  const [vis, setVis] = useState<Visibility>(visibility);
  const [lending, setLending] = useState(lendingEnabled);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const save = (next: { visibility?: Visibility; lendingEnabled?: boolean }) =>
    startTransition(async () => {
      const result = await setSharingAction(userBookId, next);
      if (result.ok) router.refresh();
      else toast(result.error, "error");
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Sichtbarkeit</p>
        <Segmented
          id={`vis-${userBookId}`}
          value={vis}
          onChange={(next) => {
            setVis(next);
            if (next === "PRIVATE") setLending(false);
            save({ visibility: next, lendingEnabled: next === "PRIVATE" ? false : lending });
          }}
          size="sm"
          options={[
            { value: "PRIVATE", label: "Privat", icon: <Lock size={14} /> },
            { value: "FRIENDS", label: "Freunde", icon: <Users size={14} /> },
          ]}
        />
        <p className="mt-2 text-xs text-ink-faint">{VISIBILITY_META[vis].hint}</p>
      </div>

      <div className="border-t border-ink/8 pt-4 dark:border-white/8">
        <Switch
          checked={lending}
          disabled={vis === "PRIVATE"}
          onChange={(next) => {
            setLending(next);
            save({ lendingEnabled: next });
          }}
          label={
            <span className="inline-flex items-center gap-1.5">
              <HandHeart size={14} className="text-clay-500" />
              Ausleihen erlauben
            </span>
          }
          hint={
            vis === "PRIVATE"
              ? "Nur möglich, wenn das Buch mit Freunden geteilt ist."
              : "Freigegebene Freunde dürfen Ausleihanfragen stellen."
          }
        />
      </div>
    </div>
  );
}
