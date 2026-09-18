import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { db } from "@/lib/db";

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE = "regal_session";
const SESSION_TTL_DAYS = 30;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET fehlt oder ist zu kurz – bitte in .env setzen.");
  }
  return value;
}

/* ───────────────────────────────────────────── Passwörter (scrypt, ohne Extra-Dependency) */

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password.normalize("NFKC"), salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(password.normalize("NFKC"), salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

/* ───────────────────────────────────────────── Session-Cookie (signiert) */

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function serializeToken(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`;
}

function parseToken(token: string | undefined) {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const id = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return id;
}

export async function createSession(userId: string, userAgent?: string | null) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const session = await db.session.create({
    data: { userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, serializeToken(session.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = parseToken(jar.get(SESSION_COOKIE)?.value);
  if (id) await db.session.deleteMany({ where: { id } });
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  accentColor: string;
  bio: string | null;
};

/**
 * Aktueller Benutzer oder null. Pro Request gecacht, damit Layout, Seite und
 * Server Actions sich nicht gegenseitig Abfragen duplizieren.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const sessionId = parseToken(jar.get(SESSION_COOKIE)?.value);
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          accentColor: true,
          bio: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { id: sessionId } });
    return null;
  }
  return session.user;
});

/** Für Seiten: leitet zum Login, wenn nicht angemeldet. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Für Server Actions / API-Routen: wirft, statt zu redirecten. */
export async function requireUserStrict(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
