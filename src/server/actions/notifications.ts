"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import type { ActionResult } from "@/server/actions/books";

function revalidateAll() {
  revalidatePath("/notifications");
  revalidatePath("/");
  revalidatePath("/books");
  revalidatePath("/loans");
  revalidatePath("/friends");
}

export async function markNotificationReadAction(
  notificationId: string,
  read = true,
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await db.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { read },
    });
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "Das hat nicht funktioniert." };
  }
}

export async function markAllNotificationsReadAction(category?: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await db.notification.updateMany({
      where: {
        userId: user.id,
        read: false,
        ...(category && category !== "ALL" ? { category } : {}),
      },
      data: { read: true },
    });
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "Das hat nicht funktioniert." };
  }
}

export async function deleteNotificationAction(notificationId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await db.notification.deleteMany({ where: { id: notificationId, userId: user.id } });
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "Das hat nicht funktioniert." };
  }
}
