import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <div className="animate-[rise_0.5s_var(--ease-cozy)_both]">
      <h1 className="text-3xl text-ink">Willkommen zurück</h1>
      <p className="mt-2 text-sm text-ink-faint">
        Melde dich an, um dein Regal, deine Notizen und deine Ausleihen zu sehen.
      </p>
      <LoginForm />
      <p className="mt-8 text-center text-sm text-ink-faint">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-medium text-clay-600 underline-offset-4 hover:underline dark:text-clay-300">
          Regal anlegen
        </Link>
      </p>
    </div>
  );
}
