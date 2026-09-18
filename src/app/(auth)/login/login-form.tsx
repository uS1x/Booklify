"use client";

import { useActionState } from "react";

import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <Field label="E-Mail oder Benutzername">
        <Input
          name="email"
          type="text"
          autoComplete="username"
          required
          placeholder="du@beispiel.de"
        />
      </Field>

      <Field label="Passwort">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      {state?.error ? (
        <p className="rounded-xl bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700 dark:bg-clay-700/20 dark:text-clay-200">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "Wird geöffnet …" : "Regal öffnen"}
      </Button>
    </form>
  );
}
