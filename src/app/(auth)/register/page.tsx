import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Regal anlegen" };

export default function RegisterPage() {
  return (
    <div className="animate-[rise_0.5s_var(--ease-cozy)_both]">
      <h1 className="text-3xl text-ink">Dein Regal beginnt hier</h1>
      <p className="mt-2 text-sm text-ink-faint">
        Ein Konto, dein Regal – privat, bis du es bewusst mit Freunden teilst.
      </p>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-ink-faint">
        Schon dabei?{" "}
        <Link href="/login" className="font-medium text-clay-600 underline-offset-4 hover:underline dark:text-clay-300">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
