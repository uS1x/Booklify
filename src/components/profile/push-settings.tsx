"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction,
  updateNotificationPrefsAction,
} from "@/server/actions/push";

export type NotificationPrefs = {
  pushEnabled: boolean;
  friendRequests: boolean;
  loanRequests: boolean;
  loanUpdates: boolean;
  returnReminders: boolean;
  system: boolean;
};

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Web-Push-Verwaltung: Berechtigung anfragen, Subscription speichern,
 * Testbenachrichtigung senden und einzelne Kategorien steuern.
 */
export function PushSettings({
  prefs,
  vapidPublicKey,
  deviceCount,
}: {
  prefs: NotificationPrefs;
  vapidPublicKey: string | null;
  deviceCount: number;
}) {
  const [state, setState] = useState(prefs);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => setSubscribed(false));
  }, []);

  const enable = async () => {
    if (!vapidPublicKey) {
      toast("Auf dem Server fehlen die VAPID-Schlüssel (npm run push:keys).", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast("Ohne Berechtigung kann der Browser keine Push-Nachrichten anzeigen.", "info");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        toast("Der Browser hat keine vollständige Subscription geliefert.", "error");
        return;
      }

      const response = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (response.ok) {
        setSubscribed(true);
        setState((prev) => ({ ...prev, pushEnabled: true }));
        toast("Push aktiviert – dieses Gerät erhält Benachrichtigungen");
        router.refresh();
      } else {
        toast(response.error, "error");
      }
    } catch (error) {
      console.error(error);
      toast("Push konnte nicht aktiviert werden.", "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
      const response = await removePushSubscriptionAction(endpoint);
      if (response.ok) {
        setSubscribed(false);
        setState((prev) => ({ ...prev, pushEnabled: false }));
        toast("Push auf diesem Gerät deaktiviert");
        router.refresh();
      } else {
        toast(response.error, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const togglePref = (key: keyof NotificationPrefs, value: boolean) => {
    setState((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      const result = await updateNotificationPrefsAction({ [key]: value });
      if (!result.ok) toast(result.error, "error");
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {!supported ? (
        <p className="rounded-xl bg-paper-soft px-3.5 py-3 text-sm text-ink-soft dark:bg-white/5">
          Dieser Browser unterstützt keine Web-Push-Benachrichtigungen. In-App-Benachrichtigungen
          funktionieren trotzdem.
        </p>
      ) : !vapidPublicKey ? (
        <p className="rounded-xl bg-paper-soft px-3.5 py-3 text-sm text-ink-soft dark:bg-white/5">
          Push ist serverseitig noch nicht eingerichtet. Schlüssel erzeugen mit{" "}
          <code className="rounded bg-ink/8 px-1.5 py-0.5">npm run push:keys</code> und Server neu starten.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {subscribed ? (
            <>
              <Button variant="soft" onClick={disable} disabled={busy}>
                <BellOff size={16} />
                Push deaktivieren
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    const result = await sendTestPushAction();
                    toast(
                      result.ok ? "Testbenachrichtigung gesendet" : result.error,
                      result.ok ? "success" : "error",
                    );
                  })
                }
              >
                <Send size={16} />
                Test senden
              </Button>
            </>
          ) : (
            <Button onClick={enable} disabled={busy}>
              <BellRing size={16} />
              {busy ? "Wird aktiviert …" : "Push auf diesem Gerät aktivieren"}
            </Button>
          )}

          <span className="text-xs text-ink-faint">
            {permission === "denied"
              ? "Berechtigung im Browser blockiert – bitte in den Website-Einstellungen erlauben."
              : deviceCount
                ? `${deviceCount} Gerät${deviceCount === 1 ? "" : "e"} registriert`
                : "Noch kein Gerät registriert"}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-ink/8 pt-5 dark:border-white/8">
        <p className="text-sm font-medium text-ink">Wovon möchtest du erfahren?</p>
        <Switch
          checked={state.friendRequests}
          onChange={(value) => togglePref("friendRequests", value)}
          label="Freundschaftsanfragen"
          hint="Neue Anfragen und Bestätigungen."
        />
        <Switch
          checked={state.loanRequests}
          onChange={(value) => togglePref("loanRequests", value)}
          label="Ausleihanfragen"
          hint="Wenn ein Freund ein Buch von dir anfragt."
        />
        <Switch
          checked={state.loanUpdates}
          onChange={(value) => togglePref("loanUpdates", value)}
          label="Ausleih-Updates"
          hint="Zusagen, Ablehnungen, Rückgaben."
        />
        <Switch
          checked={state.returnReminders}
          onChange={(value) => togglePref("returnReminders", value)}
          label="Rückgabe-Erinnerungen"
          hint="Kurz vor dem vereinbarten Rückgabedatum."
        />
        <Switch
          checked={state.system}
          onChange={(value) => togglePref("system", value)}
          label="Hinweise der App"
          hint="Selten – nur wirklich Wichtiges."
        />
      </div>
    </div>
  );
}
