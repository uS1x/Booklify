import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureDueSoonNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Erinnerungen für alle Benutzer erzeugen – gedacht für einen Cron-Aufruf:
 *   curl -X POST -H "x-maintenance-key: $MAINTENANCE_KEY" http://localhost:3000/api/maintenance/reminders
 *
 * Ohne gesetzten MAINTENANCE_KEY ist die Route deaktiviert.
 */
export async function POST(request: Request) {
  const key = process.env.MAINTENANCE_KEY;
  if (!key) return NextResponse.json({ error: "DISABLED" }, { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const users = await db.user.findMany({ select: { id: true } });
  let created = 0;
  for (const user of users) created += await ensureDueSoonNotifications(user.id);

  return NextResponse.json({ users: users.length, created });
}
