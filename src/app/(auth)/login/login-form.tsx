"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";

import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <Field label="E-Mail oder Benutzername">
        <Input
          name="email"
          type="text"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="du@beispiel.de"
        />
      </Field>

      <Field label="Passwort">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

      <button
        type="button"
        onClick={() => {
          setEmail("basti@buchregal.app");
          setPassword("lesen1234");
        }}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink/15 px-4 py-3 text-xs text-ink-faint transition-colors hover:border-clay-300 hover:text-ink dark:border-white/15"
      >
        <Sparkles size={14} />
        Demo-Zugang einsetzen (basti@buchregal.app · lesen1234)
      </button>
    </form>
  );
}
