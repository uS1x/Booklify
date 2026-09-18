"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandHeart } from "lucide-react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { requestLoanAction } from "@/server/actions/loans";

/** „Ausleihe anfragen“ inklusive Bestätigungsdialog und optionaler Nachricht. */
export function LoanRequestButton({
  userBookId,
  bookTitle,
  ownerName,
  variant = "secondary",
  size = "md",
  className,
  label = "Ausleihe anfragen",
}: {
  userBookId: string;
  bookTitle: string;
  ownerName: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const send = () =>
    startTransition(async () => {
      const result = await requestLoanAction(userBookId, message);
      if (result.ok) {
        toast(`Anfrage an ${ownerName} gesendet`);
        setOpen(false);
        setMessage("");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <HandHeart size={16} />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ausleihe anfragen"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button onClick={send} disabled={pending}>
              {pending ? "Wird gesendet …" : "Anfrage senden"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 py-1">
          <p className="text-sm leading-relaxed text-ink-soft">
            Möchtest du „<span className="font-medium text-ink">{bookTitle}</span>“ bei{" "}
            <span className="font-medium text-ink">{ownerName}</span> anfragen?
          </p>
          <Field label="Nachricht" optional hint="Zum Beispiel, wann du es abholen könntest.">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={`Hallo ${ownerName}, darf ich …`}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
