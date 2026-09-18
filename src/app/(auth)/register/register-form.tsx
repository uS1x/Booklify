"use client";

import { useActionState, useState } from "react";

import { registerAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { slugify } from "@/lib/format";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [touchedUsername, setTouchedUsername] = useState(false);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <Field label="Name">
        <Input
          name="displayName"
          required
          autoComplete="name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (!touchedUsername) setUsername(slugify(e.target.value));
          }}
          placeholder="Wie sollen dich Freunde sehen?"
        />
      </Field>

      <Field label="Benutzername" hint="Damit finden dich Freunde.">
        <Input
          name="username"
          required
          minLength={3}
          value={username}
          onChange={(e) => {
            setTouchedUsername(true);
            setUsername(e.target.value.toLowerCase());
          }}
          placeholder="lesemaus"
        />
      </Field>

      <Field label="E-Mail">
        <Input name="email" type="email" required autoComplete="email" placeholder="du@beispiel.de" />
      </Field>

      <Field label="Passwort" hint="Mindestens 8 Zeichen.">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" />
      </Field>

      {state?.error ? (
        <p className="rounded-xl bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700 dark:bg-clay-700/20 dark:text-clay-200">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "Regal wird gebaut …" : "Regal anlegen"}
      </Button>
    </form>
  );
}
