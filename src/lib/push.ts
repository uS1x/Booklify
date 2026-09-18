import "server-only";

import webpush from "web-push";
import { db } from "@/lib/db";

export type PushPayload = {
  title: string;
  body?: string;
  href?: string;
  tag?: string;
  icon?: string;
};

let configured: boolean | null = null;

/** VAPID-Konfiguration einmalig setzen. Ohne Keys bleibt Push deaktiviert. */
function ensureConfigured() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", publicKey, privateKey);
  configured = true;
  return true;
}

export const isPushConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/**
 * Sendet an alle Geräte eines Benutzers. Abgelaufene Subscriptions
 * (404/410) werden automatisch entfernt.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return { sent: 0, removed: 0 };

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
        else console.warn("[push] Zustellung fehlgeschlagen:", status ?? error);
      }
    }),
  );

  if (stale.length) await db.pushSubscription.deleteMany({ where: { id: { in: stale } } });
  if (sent) {
    await db.pushSubscription.updateMany({
      where: { userId, id: { notIn: stale } },
      data: { lastUsedAt: new Date() },
    });
  }
  return { sent, removed: stale.length };
}
