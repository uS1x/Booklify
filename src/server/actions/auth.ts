"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { slugify } from "@/lib/format";

export type AuthState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().min(3, "Bitte E-Mail oder Benutzername angeben"),
  password: z.string().min(1, "Bitte Passwort eingeben"),
});

const registerSchema = z.object({
  displayName: z.string().min(2, "Bitte einen Namen angeben").max(60),
  email: z.string().email("Bitte eine gültige E-Mail-Adresse angeben"),
  username: z
    .string()
    .min(3, "Mindestens 3 Zeichen")
    .max(24)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Nur Buchstaben, Zahlen, . _ -"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const identifier = parsed.data.email.toLowerCase();
  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  // Gleiche Meldung für „Konto existiert nicht“ und „falsches Passwort“.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  const ua = (await headers()).get("user-agent");
  await createSession(user.id, ua);
  redirect("/");
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    username: String(formData.get("username") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
  if (!raw.username && raw.displayName) raw.username = slugify(raw.displayName);

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await db.user.findFirst({
    where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    return {
      error:
        existing.email === parsed.data.email
          ? "Für diese E-Mail existiert bereits ein Konto."
          : "Dieser Benutzername ist schon vergeben.",
    };
  }

  const user = await db.user.create({
    data: {
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      accentColor: ["clay", "honey", "sage", "plum", "ocean"][Math.floor(Math.random() * 5)],
      shelf: { create: { name: `${parsed.data.displayName}s Bücherregal`, visibility: "PRIVATE" } },
      notificationPrefs: { create: {} },
      notifications: {
        create: {
          category: "SYSTEM",
          type: "SYSTEM",
          title: "Willkommen in deinem Bücherregal",
          body: "Füge dein erstes Buch hinzu – über die Suche oder ganz manuell.",
          href: "/books/new",
        },
      },
    },
  });

  const ua = (await headers()).get("user-agent");
  await createSession(user.id, ua);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
