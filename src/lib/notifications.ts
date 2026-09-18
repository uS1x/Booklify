import "server-only";

import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import type { NotificationCategory } from "@/lib/constants";

export type NotificationType =
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "FRIEND_DECLINED"
  | "LOAN_REQUEST"
  | "LOAN_ACCEPTED"
  | "LOAN_DECLINED"
  | "LOAN_CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURN_CONFIRMED"
  | "RETURN_DUE_SOON"
  | "SHELF_SHARED"
  | "SYSTEM";

const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  FRIEND_REQUEST: "FRIEND",
  FRIEND_ACCEPTED: "FRIEND",
  FRIEND_DECLINED: "FRIEND",
  SHELF_SHARED: "FRIEND",
  LOAN_REQUEST: "LOAN",
  LOAN_ACCEPTED: "LOAN",
  LOAN_DECLINED: "LOAN",
  LOAN_CANCELLED: "LOAN",
  RETURN_REQUESTED: "LOAN",
  RETURN_CONFIRMED: "LOAN",
  RETURN_DUE_SOON: "LOAN",
  SYSTEM: "SYSTEM",
};

/** Welche Präferenz steuert welchen Typ. */
const PREF_OF: Record<NotificationType, keyof PrefFlags> = {
  FRIEND_REQUEST: "friendRequests",
  FRIEND_ACCEPTED: "friendRequests",
  FRIEND_DECLINED: "friendRequests",
  SHELF_SHARED: "friendRequests",
  LOAN_REQUEST: "loanRequests",
  LOAN_ACCEPTED: "loanUpdates",
  LOAN_DECLINED: "loanUpdates",
  LOAN_CANCELLED: "loanUpdates",
  RETURN_REQUESTED: "loanUpdates",
  RETURN_CONFIRMED: "loanUpdates",
  RETURN_DUE_SOON: "returnReminders",
  SYSTEM: "system",
};

type PrefFlags = {
  friendRequests: boolean;
  loanRequests: boolean;
  loanUpdates: boolean;
  returnReminders: boolean;
  system: boolean;
};

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  actorId?: string;
  entityId?: string;
};

/**
 * Legt eine In-App-Benachrichtigung an und schickt – sofern aktiviert –
 * zusätzlich eine Web-Push-Nachricht.
 */
export async function notify(input: NotifyInput) {
  const category = CATEGORY_OF[input.type] ?? "SYSTEM";

  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      category,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      actorId: input.actorId ?? null,
      entityId: input.entityId ?? null,
    },
  });

  const prefs = await db.notificationPreference.findUnique({ where: { userId: input.userId } });
  if (prefs?.pushEnabled && prefs[PREF_OF[input.type]] !== false) {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      href: input.href ?? "/notifications",
      tag: `${input.type}-${input.entityId ?? notification.id}`,
    }).catch((error) => console.warn("[notify] Push fehlgeschlagen:", error));
  }

  return notification;
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, read: false } });
}

/**
 * Erinnerungen für bevorstehende Rückgaben anlegen (idempotent).
 * Wird beim Öffnen der App geprüft und kann zusätzlich per Cron über
 * /api/maintenance/reminders für alle Benutzer ausgelöst werden.
 */
export async function ensureDueSoonNotifications(userId: string) {
  const soon = new Date(Date.now() + 3 * 86400_000);

  const loans = await db.loan.findMany({
    where: {
      status: { in: ["ACTIVE", "RETURN_REQUESTED"] },
      dueDate: { not: null, lte: soon },
      OR: [{ lenderId: userId }, { borrowerId: userId }],
    },
    select: {
      id: true,
      dueDate: true,
      lenderId: true,
      borrowerId: true,
      lender: { select: { displayName: true } },
      borrower: { select: { displayName: true } },
      userBook: { select: { book: { select: { title: true } } } },
    },
  });
  if (!loans.length) return 0;

  const existing = await db.notification.findMany({
    where: {
      userId,
      type: "RETURN_DUE_SOON",
      entityId: { in: loans.map((loan) => loan.id) },
      createdAt: { gte: new Date(Date.now() - 2 * 86400_000) },
    },
    select: { entityId: true },
  });
  const alreadyNotified = new Set(existing.map((entry) => entry.entityId));

  let created = 0;
  for (const loan of loans) {
    if (alreadyNotified.has(loan.id) || !loan.dueDate) continue;

    const days = Math.round((loan.dueDate.getTime() - Date.now()) / 86400_000);
    const isLender = loan.lenderId === userId;
    const counterpart = isLender ? loan.borrower.displayName : loan.lender.displayName;
    const timing =
      days < 0 ? `ist seit ${Math.abs(days)} Tagen fällig` : days === 0 ? "ist heute fällig" : `ist in ${days} Tagen fällig`;

    await notify({
      userId,
      type: "RETURN_DUE_SOON",
      title: days < 0 ? "Rückgabe überfällig" : "Rückgabe steht bevor",
      body: isLender
        ? `„${loan.userBook.book.title}“ bei ${counterpart} ${timing}.`
        : `„${loan.userBook.book.title}“ von ${counterpart} ${timing}.`,
      href: "/loans",
      entityId: loan.id,
    });
    created++;
  }
  return created;
}
