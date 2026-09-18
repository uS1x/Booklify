"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, Check, CheckCheck, HandHeart, Info, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  deleteNotificationAction, markAllNotificationsReadAction, markNotificationReadAction,
} from "@/server/actions/notifications";
import { NOTIFICATION_CATEGORY_LABEL } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";

export type NotificationDTO = {
  id: string;
  category: "FRIEND" | "LOAN" | "SYSTEM";
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
  actor: { displayName: string; accentColor: string; username: string } | null;
};

const CATEGORY_ICON = { FRIEND: Users, LOAN: HandHeart, SYSTEM: Info } as const;

/** Benachrichtigungscenter mit Kategorien und Lesestatus. */
export function NotificationList({ notifications }: { notifications: NotificationDTO[] }) {
  const [category, setCategory] = useState<"ALL" | "FRIEND" | "LOAN" | "SYSTEM">("ALL");
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const filtered = notifications.filter((entry) => category === "ALL" || entry.category === category);
  const unread = filtered.filter((entry) => !entry.read).length;

  const counts = {
    ALL: notifications.filter((n) => !n.read).length,
    FRIEND: notifications.filter((n) => !n.read && n.category === "FRIEND").length,
    LOAN: notifications.filter((n) => !n.read && n.category === "LOAN").length,
    SYSTEM: notifications.filter((n) => !n.read && n.category === "SYSTEM").length,
  };

  const run = (action: Promise<{ ok: boolean; error?: string }>, message?: string) =>
    startTransition(async () => {
      const result = await action;
      if (result.ok) {
        if (message) toast(message);
        router.refresh();
      } else {
        toast(result.error ?? "Das hat nicht funktioniert.", "error");
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          id="notification-category"
          value={category}
          onChange={setCategory}
          size="sm"
          options={(["ALL", "FRIEND", "LOAN", "SYSTEM"] as const).map((key) => ({
            value: key,
            label: (
              <span className="flex items-center gap-1.5">
                {NOTIFICATION_CATEGORY_LABEL[key]}
                {counts[key] ? (
                  <span className="rounded-full bg-clay-500 px-1.5 text-[10px] font-semibold text-white">
                    {counts[key]}
                  </span>
                ) : null}
              </span>
            ),
          }))}
        />

        {unread ? (
          <Button
            variant="soft"
            size="sm"
            onClick={() => run(markAllNotificationsReadAction(category), "Alle als gelesen markiert")}
          >
            <CheckCheck size={15} />
            Alle als gelesen
          </Button>
        ) : null}
      </div>

      {filtered.length ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((entry) => {
            const Icon = CATEGORY_ICON[entry.category] ?? Bell;
            return (
              <li
                key={entry.id}
                className={cn(
                  "group flex gap-3 rounded-2xl border p-4 transition-colors",
                  entry.read
                    ? "border-ink/8 bg-surface dark:border-white/8"
                    : "border-clay-200 bg-clay-50/70 dark:border-clay-400/30 dark:bg-clay-500/10",
                )}
              >
                {entry.actor ? (
                  <Avatar name={entry.actor.displayName} accentColor={entry.actor.accentColor} size="sm" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-deep/70 text-ink-soft dark:bg-white/10">
                    <Icon size={15} />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className={cn("text-sm", entry.read ? "text-ink-soft" : "font-medium text-ink")}>
                      {entry.title}
                    </p>
                    {!entry.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-clay-500" /> : null}
                  </div>
                  {entry.body ? <p className="mt-0.5 text-sm text-ink-soft">{entry.body}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-faint">
                    <span>{formatRelative(entry.createdAt)}</span>
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        onClick={() => {
                          if (!entry.read) void markNotificationReadAction(entry.id);
                        }}
                        className="inline-flex items-center gap-1 text-clay-600 underline-offset-2 hover:underline dark:text-clay-300"
                      >
                        <BookOpen size={11} />
                        öffnen
                      </Link>
                    ) : null}
                    {!entry.read ? (
                      <button
                        type="button"
                        onClick={() => run(markNotificationReadAction(entry.id))}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        <Check size={11} />
                        als gelesen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => run(deleteNotificationAction(entry.id))}
                      className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 hover:text-clay-600"
                    >
                      <Trash2 size={11} />
                      entfernen
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Bell size={22} />}
          title="Keine Benachrichtigungen"
          description="Hier landen Freundschaftsanfragen, Ausleihen und Rückgaben."
        />
      )}
    </div>
  );
}
