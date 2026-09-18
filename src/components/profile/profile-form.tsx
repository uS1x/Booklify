"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { updateProfileAction } from "@/server/actions/profile";
import { ACCENT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/cn";

export function ProfileForm({
  displayName,
  bio,
  accentColor,
  username,
  email,
}: {
  displayName: string;
  bio: string | null;
  accentColor: string;
  username: string;
  email: string;
}) {
  const [form, setForm] = useState({ displayName, bio: bio ?? "", accentColor });
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const save = () =>
    startTransition(async () => {
      const result = await updateProfileAction(form);
      if (result.ok) {
        toast("Profil gespeichert");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar name={form.displayName || displayName} accentColor={form.accentColor} size="xl" />
        <div className="min-w-0">
          <p className="text-sm text-ink">@{username}</p>
          <p className="truncate text-xs text-ink-faint">{email}</p>
        </div>
      </div>

      <Field label="Anzeigename">
        <Input
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
        />
      </Field>

      <Field label="Über mich" optional hint="Sehen deine Freunde in der Freundesliste.">
        <Textarea
          value={form.bio}
          onChange={(event) => setForm({ ...form, bio: event.target.value })}
          rows={3}
          placeholder="Was liest du gerne?"
        />
      </Field>

      <Field label="Akzentfarbe">
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              onClick={() => setForm({ ...form, accentColor: color.key })}
              title={color.label}
              aria-label={color.label}
              className={cn(
                "size-9 rounded-full border-2 transition-transform",
                form.accentColor === color.key ? "scale-110 border-ink dark:border-paper" : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </Field>

      <div>
        <Button onClick={save} disabled={pending}>
          {pending ? "Speichern …" : "Profil speichern"}
        </Button>
      </div>
    </div>
  );
}
