import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, LogOut, Share2, UserRound, Palette, ShieldCheck } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPushConfigured } from "@/lib/push";
import { activeProvider } from "@/lib/providers/books";
import { activeImageProvider } from "@/lib/providers/images";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/profile/profile-form";
import { ShelfSettings } from "@/components/profile/shelf-settings";
import { PushSettings } from "@/components/profile/push-settings";
import { ThemePicker } from "@/components/profile/theme-picker";
import { logoutAction } from "@/server/actions/auth";
import { SHELF_PERMISSION_META, type Visibility } from "@/lib/constants";
import { formatDate, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Profil & Einstellungen" };

export default async function ProfilePage() {
  const user = await requireUser();

  const [profile, shelf, prefs, devices, counts] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { displayName: true, bio: true, accentColor: true, username: true, email: true, createdAt: true },
    }),
    db.sharedShelf.findUnique({
      where: { ownerId: user.id },
      select: {
        name: true,
        description: true,
        visibility: true,
        members: {
          select: {
            permission: true,
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    }),
    db.notificationPreference.findUnique({ where: { userId: user.id } }),
    db.pushSubscription.count({ where: { userId: user.id } }),
    Promise.all([
      db.userBook.count({ where: { userId: user.id } }),
      db.userBook.count({ where: { userId: user.id, visibility: "FRIENDS" } }),
      db.userBook.count({ where: { userId: user.id, lendingEnabled: true } }),
    ]),
  ]);

  const [totalBooks, sharedBooks, lendableBooks] = counts;
  const bookProvider = activeProvider();
  const imageProvider = activeImageProvider();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">Profil & Einstellungen</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Dabei seit {formatDate(profile.createdAt)} · {pluralize(totalBooks, "Buch", "Bücher")} im Regal
        </p>
      </header>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <UserRound size={17} className="text-ink-faint" />
              Profil
            </span>
          }
          subtitle="So sehen dich deine Freunde."
        />
        <CardBody>
          <ProfileForm
            displayName={profile.displayName}
            bio={profile.bio}
            accentColor={profile.accentColor}
            username={profile.username}
            email={profile.email}
          />
        </CardBody>
      </Card>

      <Card id="sharing">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Share2 size={17} className="text-ink-faint" />
              Mein Bücherregal teilen
            </span>
          }
          subtitle="Privat, mit Freunden geteilt – oder gezielt pro Person."
        />
        <CardBody>
          <ShelfSettings
            name={shelf?.name ?? "Mein Bücherregal"}
            description={shelf?.description ?? null}
            visibility={(shelf?.visibility ?? "PRIVATE") as Visibility}
          />

          <div className="mt-6 border-t border-ink/8 pt-5 dark:border-white/8">
            <p className="mb-3 text-sm font-medium text-ink">Freigaben für einzelne Freunde</p>
            {shelf?.members.length ? (
              <ul className="flex flex-col gap-2">
                {shelf.members.map((member) => (
                  <li
                    key={member.user.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted/60 px-3.5 py-2.5 dark:bg-white/5"
                  >
                    <span className="text-sm text-ink">
                      {member.user.displayName}{" "}
                      <span className="text-ink-faint">@{member.user.username}</span>
                    </span>
                    <Badge tone="bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200">
                      {SHELF_PERMISSION_META[member.permission as "VIEW"].label}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">
                Noch keine einzelnen Freigaben. Du kannst sie in der{" "}
                <Link href="/friends" className="text-clay-600 underline-offset-2 hover:underline dark:text-clay-300">
                  Freundesliste
                </Link>{" "}
                pro Freund setzen.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-faint">
              <Badge>{pluralize(sharedBooks, "Buch geteilt", "Bücher geteilt")}</Badge>
              <Badge>{pluralize(lendableBooks, "Buch ausleihbar", "Bücher ausleihbar")}</Badge>
              <Badge>{pluralize(totalBooks - sharedBooks, "Buch privat", "Bücher privat")}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card id="push">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <BellRing size={17} className="text-ink-faint" />
              Benachrichtigungen
            </span>
          }
          subtitle="In-App immer, Push auf Wunsch."
        />
        <CardBody>
          <PushSettings
            prefs={{
              pushEnabled: prefs?.pushEnabled ?? false,
              friendRequests: prefs?.friendRequests ?? true,
              loanRequests: prefs?.loanRequests ?? true,
              loanUpdates: prefs?.loanUpdates ?? true,
              returnReminders: prefs?.returnReminders ?? true,
              system: prefs?.system ?? true,
            }}
            vapidPublicKey={isPushConfigured() ? (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null) : null}
            deviceCount={devices}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Palette size={17} className="text-ink-faint" />
              Darstellung
            </span>
          }
          subtitle="Hell, dunkel oder automatisch."
        />
        <CardBody>
          <ThemePicker />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-ink-faint" />
              Datenquellen & Datenschutz
            </span>
          }
          subtitle="Was diese Installation nutzt."
        />
        <CardBody>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-faint">Buch-Metadaten</dt>
              <dd className="text-ink">
                {bookProvider.configured ? bookProvider.label : "keine API – manuelle Eingabe"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Bildsuche fürs Moodboard</dt>
              <dd className="text-ink">
                {imageProvider.configured ? imageProvider.label : "nicht eingerichtet (Upload möglich)"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Web Push</dt>
              <dd className="text-ink">{isPushConfigured() ? "eingerichtet" : "VAPID-Schlüssel fehlen"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Sichtbarkeitsprüfung</dt>
              <dd className="text-ink">serverseitig bei jedem Zugriff</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Notizen, Bewertungen, Fragebogen-Antworten, Moodboards und Zeichnungen sind immer privat.
            Freunde sehen ausschließlich Bücher, die du ausdrücklich geteilt hast – geprüft wird das
            auf dem Server, nicht im Browser.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              <LogOut size={16} />
              Abmelden
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
