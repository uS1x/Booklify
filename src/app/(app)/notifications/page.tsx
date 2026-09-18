import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationList, type NotificationDTO } from "@/components/notifications/notification-list";
import { ButtonLink } from "@/components/ui/button";
import { BellRing } from "lucide-react";

export const metadata: Metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const user = await requireUser();

  const [rows, prefs] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { actor: { select: { displayName: true, accentColor: true, username: true } } },
    }),
    db.notificationPreference.findUnique({ where: { userId: user.id }, select: { pushEnabled: true } }),
  ]);

  const notifications: NotificationDTO[] = rows.map((row) => ({
    id: row.id,
    category: row.category as NotificationDTO["category"],
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">Benachrichtigungen</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Freundschaften, Ausleihen und Rückgaben – chronologisch sortiert.
          </p>
        </div>
        {!prefs?.pushEnabled ? (
          <ButtonLink href="/profile#push" variant="soft" size="sm">
            <BellRing size={15} />
            Push aktivieren
          </ButtonLink>
        ) : null}
      </header>

      <NotificationList notifications={notifications} />
    </div>
  );
}
