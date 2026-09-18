"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { updateShelfSettingsAction } from "@/server/actions/friends";
import { VISIBILITY_META, type Visibility } from "@/lib/constants";

/** Name, Beschreibung und Grundsichtbarkeit des eigenen Regals. */
export function ShelfSettings({
  name,
  description,
  visibility,
}: {
  name: string;
  description: string | null;
  visibility: Visibility;
}) {
  const [form, setForm] = useState({ name, description: description ?? "", visibility });
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const save = (next = form) =>
    startTransition(async () => {
      const result = await updateShelfSettingsAction(next);
      if (result.ok) {
        toast("Regal-Einstellungen gespeichert");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <div className="flex flex-col gap-5">
      <Field label="Name deines Regals">
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>

      <Field label="Beschreibung" optional>
        <Textarea
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          rows={2}
          placeholder="Was steht bei dir im Regal?"
        />
      </Field>

      <Field
        label="Grundsichtbarkeit"
        hint="Einzelne Bücher bleiben trotzdem privat, solange du sie nicht teilst."
      >
        <Segmented
          id="shelf-visibility"
          value={form.visibility}
          onChange={(next) => {
            const updated = { ...form, visibility: next };
            setForm(updated);
            save(updated);
          }}
          options={[
            { value: "PRIVATE", label: "Privat", icon: <Lock size={14} /> },
            { value: "FRIENDS", label: "Mit Freunden geteilt", icon: <Users size={14} /> },
          ]}
        />
        <p className="mt-2 text-xs text-ink-faint">
          {form.visibility === "FRIENDS"
            ? "Alle bestätigten Freunde dürfen deine geteilten Bücher sehen. Ausleihen erlaubst du zusätzlich pro Freund und pro Buch."
            : "Nur Freunde, die du einzeln freischaltest, sehen deine geteilten Bücher."}
        </p>
      </Field>

      <div>
        <Button onClick={() => save()} disabled={pending}>
          {pending ? "Speichern …" : "Regal speichern"}
        </Button>
      </div>

      <p className="text-xs text-ink-faint">{VISIBILITY_META[form.visibility].hint}</p>
    </div>
  );
}
