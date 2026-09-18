"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserMinus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  acceptFriendRequestAction, cancelFriendRequestAction, declineFriendRequestAction,
  removeFriendAction, setShelfMemberAction,
} from "@/server/actions/friends";
import { SHELF_PERMISSION_META, type ShelfPermission } from "@/lib/constants";
import { cn } from "@/lib/cn";

/** Freigabe meines Regals für einen einzelnen Freund. */
export function ShelfPermissionPicker({
  friendUserId,
  friendName,
  value,
}: {
  friendUserId: string;
  friendName: string;
  value: ShelfPermission | "NONE";
}) {
  const [current, setCurrent] = useState<ShelfPermission | "NONE">(value);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const options: (ShelfPermission | "NONE")[] = ["NONE", "VIEW", "REQUEST_LOAN"];

  const change = (next: ShelfPermission | "NONE") => {
    setCurrent(next);
    startTransition(async () => {
      const result = await setShelfMemberAction(friendUserId, next === "NONE" ? null : next);
      if (result.ok) {
        toast(
          next === "NONE"
            ? `${friendName} sieht dein Regal nicht mehr`
            : `${friendName}: ${SHELF_PERMISSION_META[next].label}`,
        );
        router.refresh();
      } else {
        toast(result.error, "error");
        setCurrent(value);
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => change(option)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs transition-colors",
            current === option
              ? "border-transparent bg-ink text-paper dark:bg-clay-400 dark:text-ink"
              : "border-ink/12 text-ink-soft hover:border-clay-300 dark:border-white/12",
          )}
        >
          {option === "NONE" ? "Nicht geteilt" : SHELF_PERMISSION_META[option].label}
        </button>
      ))}
    </div>
  );
}

export function RemoveFriendButton({ friendUserId, friendName }: { friendUserId: string; friendName: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <UserMinus size={14} />
        Entfernen
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${friendName} entfernen?`}
        description="Ihr seht danach die Regale des anderen nicht mehr. Offene Ausleihanfragen werden storniert, laufende Ausleihen bleiben bestehen."
        confirmLabel="Freundschaft beenden"
        tone="danger"
        onConfirm={async () => {
          const result = await removeFriendAction(friendUserId);
          if (result.ok) {
            toast(`${friendName} entfernt`);
            router.refresh();
          } else {
            toast(result.error, "error");
          }
        }}
      />
    </>
  );
}

export function RequestDecision({
  friendshipId,
  name,
  direction,
}: {
  friendshipId: string;
  name: string;
  direction: "incoming" | "outgoing";
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const run = (action: Promise<{ ok: boolean; error?: string }>, message: string) =>
    startTransition(async () => {
      const result = await action;
      if (result.ok) {
        toast(message);
        router.refresh();
      } else {
        toast(result.error ?? "Das hat nicht funktioniert.", "error");
      }
    });

  if (direction === "outgoing") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(cancelFriendRequestAction(friendshipId), "Anfrage zurückgezogen")}
      >
        <X size={14} />
        Zurückziehen
      </Button>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(acceptFriendRequestAction(friendshipId), `${name} ist jetzt dein Freund`)}
      >
        <Check size={14} />
        Annehmen
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(declineFriendRequestAction(friendshipId), "Anfrage abgelehnt")}
      >
        <X size={14} />
        Ablehnen
      </Button>
    </div>
  );
}
