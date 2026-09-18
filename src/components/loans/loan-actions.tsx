"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerUpLeft, PackageCheck, X } from "lucide-react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  acceptLoanRequestAction,
  cancelLoanRequestAction,
  confirmReturnAction,
  declineLoanRequestAction,
  requestReturnAction,
} from "@/server/actions/loans";

const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Annehmen – mit optionalem Ausleih- und Rückgabedatum. */
export function AcceptRequestButton({
  requestId,
  bookTitle,
  requesterName,
  size = "sm",
}: {
  requestId: string;
  bookTitle: string;
  requesterName: string;
  size?: ButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(inDays(28));
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const accept = () =>
    startTransition(async () => {
      const result = await acceptLoanRequestAction(requestId, { startDate, dueDate, note });
      if (result.ok) {
        toast(`Ausleihe an ${requesterName} bestätigt`);
        setOpen(false);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Check size={15} />
        Annehmen
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ausleihe bestätigen"
        description={`„${bookTitle}“ an ${requesterName}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button onClick={accept} disabled={pending}>
              {pending ? "Wird bestätigt …" : "Ausleihe starten"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 py-1">
          {/* Subgrid hält Beschriftung und Eingabefeld beider Spalten auf einer Linie,
              auch wenn eine Beschriftung umbricht. */}
          <div className="grid gap-3 sm:grid-cols-2 sm:grid-rows-[auto_auto] sm:gap-y-0">
            <Field label="Ausleihdatum" optional className="sm:row-span-2 sm:grid sm:grid-rows-subgrid">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Rückgabe bis" optional className="sm:row-span-2 sm:grid sm:grid-rows-subgrid">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            {[14, 28, 56].map((days) => (
              <Button key={days} variant="soft" size="sm" onClick={() => setDueDate(inDays(days))}>
                {days === 14 ? "2 Wochen" : days === 28 ? "4 Wochen" : "8 Wochen"}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setDueDate("")}>
              ohne Frist
            </Button>
          </div>
          <Field label="Notiz" optional>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Übergabe, Zustand …" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function DeclineRequestButton({
  requestId,
  bookTitle,
  size = "sm",
}: {
  requestId: string;
  bookTitle: string;
  size?: ButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)}>
        <X size={15} />
        Ablehnen
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Anfrage ablehnen?"
        description={`Die Anfrage zu „${bookTitle}“ wird abgelehnt. Der Freund wird benachrichtigt.`}
        confirmLabel="Ablehnen"
        tone="danger"
        onConfirm={async () => {
          const result = await declineLoanRequestAction(requestId);
          if (result.ok) {
            toast("Anfrage abgelehnt");
            router.refresh();
          } else {
            toast(result.error, "error");
          }
        }}
      />
    </>
  );
}

export function CancelRequestButton({ requestId, size = "sm" }: { requestId: string; size?: ButtonSize }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size={size}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelLoanRequestAction(requestId);
          if (result.ok) {
            toast("Anfrage zurückgezogen");
            router.refresh();
          } else {
            toast(result.error, "error");
          }
        })
      }
    >
      <X size={15} />
      Zurückziehen
    </Button>
  );
}

export function RequestReturnButton({
  loanId,
  asLender,
  size = "sm",
  variant = "soft",
}: {
  loanId: string;
  asLender: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <CornerUpLeft size={15} />
        {asLender ? "Rückgabe anfragen" : "Rückgabe ankündigen"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={asLender ? "Buch zurückfordern?" : "Rückgabe ankündigen?"}
        description={
          asLender
            ? "Wir fragen freundlich nach dem Buch. Sobald du es zurück hast, bestätigst du die Rückgabe."
            : "Der Besitzer erfährt, dass du das Buch zurückgeben möchtest, und bestätigt den Eingang."
        }
        confirmLabel="Senden"
        onConfirm={async () => {
          const result = await requestReturnAction(loanId);
          if (result.ok) {
            toast("Rückgabe angefragt");
            router.refresh();
          } else {
            toast(result.error, "error");
          }
        }}
      />
    </>
  );
}

export function ConfirmReturnButton({
  loanId,
  bookTitle,
  borrowerName,
  size = "sm",
}: {
  loanId: string;
  bookTitle: string;
  borrowerName: string;
  size?: ButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <PackageCheck size={15} />
        Als zurückgegeben markieren
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rückgabe bestätigen"
        description={`„${bookTitle}“ von ${borrowerName} zurück im Regal? Die Ausleihe wird abgeschlossen und bleibt in der Historie.`}
        confirmLabel="Rückgabe bestätigen"
        onConfirm={async () => {
          const result = await confirmReturnAction(loanId, note);
          if (result.ok) {
            toast("Rückgabe bestätigt – Buch ist wieder verfügbar");
            router.refresh();
          } else {
            toast(result.error, "error");
          }
        }}
      >
        <div className="mt-4">
          <Field label="Notiz zur Rückgabe" optional>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Zustand, Dank, Anmerkung …" />
          </Field>
        </div>
      </ConfirmDialog>
    </>
  );
}
