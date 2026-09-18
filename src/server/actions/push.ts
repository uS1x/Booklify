"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import type { ActionResult } from "@/server/actions/books";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(500) }),
});

/** Push-Subscription des Browsers speichern und Push aktivieren. */
export async function savePushSubscriptionAction(
  input: z.input<typeof subscriptionSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    if (!isPushConfigured()) {
      return { ok: false, error: "Push ist auf dem Server nicht konfiguriert (VAPID-Schlüssel fehlen)." };
    }
    const data = subscriptionSchema.parse(input);
    const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;

    await db.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
      },
      update: { userId: user.id, p256dh: data.keys.p256dh, auth: data.keys.auth, userAgent },
    });

    await db.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, pushEnabled: true },
      update: { pushEnabled: true },
    });

    revalidatePath("/profile");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "Ungültige Subscription." };
    console.error("[push]", error);
    return { ok: false, error: "Push konnte nicht aktiviert werden." };
  }
}

export async function removePushSubscriptionAction(endpoint?: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await db.pushSubscription.deleteMany({
      where: { userId: user.id, ...(endpoint ? { endpoint } : {}) },
    });
    const remaining = await db.pushSubscription.count({ where: { userId: user.id } });
    if (!remaining) {
      await db.notificationPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, pushEnabled: false },
        update: { pushEnabled: false },
      });
    }
    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Das hat nicht funktioniert." };
  }
}

const prefsSchema = z.object({
  friendRequests: z.boolean().optional(),
  loanRequests: z.boolean().optional(),
  loanUpdates: z.boolean().optional(),
  returnReminders: z.boolean().optional(),
  system: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export async function updateNotificationPrefsAction(
  input: z.input<typeof prefsSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const data = prefsSchema.parse(input);
    await db.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    revalidatePath("/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Einstellungen konnten nicht gespeichert werden." };
  }
}

/** Testbenachrichtigung an alle Geräte des Benutzers. */
export async function sendTestPushAction(): Promise<ActionResult<{ sent: number }>> {
  try {
    const user = await requireUserStrict();
    const result = await sendPushToUser(user.id, {
      title: "📚 Bücherregal",
      body: "Push funktioniert – du erfährst jetzt von Anfragen und Rückgaben.",
      href: "/notifications",
      tag: "test",
    });
    if (!result.sent) {
      return { ok: false, error: "Keine Zustellung möglich. Ist Push in diesem Browser aktiviert?" };
    }
    return { ok: true, data: { sent: result.sent } };
  } catch {
    return { ok: false, error: "Testbenachrichtigung fehlgeschlagen." };
  }
}
