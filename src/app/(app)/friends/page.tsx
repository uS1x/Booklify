import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Eye, HandHeart, Lock, UserPlus, Users } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getFriendsOverview } from "@/server/queries/friends";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FriendSearch } from "@/components/friends/friend-search";
import {
  RemoveFriendButton, RequestDecision, ShelfPermissionPicker,
} from "@/components/friends/friend-card-actions";
import { formatRelative, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Freunde" };

export default async function FriendsPage() {
  const user = await requireUser();
  const { friends, incoming, outgoing, shelf } = await getFriendsOverview(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">Freunde</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Teile dein Regal gezielt – und entscheide pro Freund, wer nur schauen und wer ausleihen darf.
        </p>
      </header>

      {/* Offene Anfragen */}
      {incoming.length || outgoing.length ? (
        <Card>
          <CardHeader
            title="Offene Anfragen"
            subtitle={`${incoming.length} eingehend · ${outgoing.length} ausgehend`}
          />
          <CardBody>
            <ul className="flex flex-col divide-y divide-ink/6 dark:divide-white/6">
              {incoming.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                  <Avatar name={request.user.displayName} accentColor={request.user.accentColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {request.user.displayName} <span className="text-ink-faint">@{request.user.username}</span>
                    </p>
                    <p className="text-xs text-ink-faint">
                      möchte mit dir Bücher teilen · {formatRelative(request.createdAt)}
                    </p>
                  </div>
                  <RequestDecision friendshipId={request.id} name={request.user.displayName} direction="incoming" />
                </li>
              ))}
              {outgoing.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                  <Avatar name={request.user.displayName} accentColor={request.user.accentColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{request.user.displayName}</p>
                    <p className="text-xs text-ink-faint">warte auf Antwort · {formatRelative(request.createdAt)}</p>
                  </div>
                  <RequestDecision friendshipId={request.id} name={request.user.displayName} direction="outgoing" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* Suche */}
      <Card>
        <CardHeader title="Freunde finden" subtitle="Suche nach Benutzername, Namen oder E-Mail." />
        <CardBody>
          <FriendSearch />
        </CardBody>
      </Card>

      {/* Freundesliste */}
      <Card>
        <CardHeader
          title={`Meine Freunde (${friends.length})`}
          subtitle={
            shelf.visibility === "FRIENDS"
              ? `„${shelf.name}“ ist grundsätzlich für Freunde sichtbar`
              : `„${shelf.name}“ ist privat – Freigaben erfolgen einzeln`
          }
          action={
            <ButtonLink href="/profile#sharing" variant="soft" size="sm">
              Regal-Einstellungen
            </ButtonLink>
          }
        />
        <CardBody>
          {friends.length ? (
            <ul className="flex flex-col gap-4">
              {friends.map((friend) => (
                <li
                  key={friend.id}
                  className="rounded-2xl border border-ink/8 bg-surface-muted/50 p-4 dark:border-white/8 dark:bg-white/4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar name={friend.displayName} accentColor={friend.accentColor} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {friend.displayName} <span className="font-normal text-ink-faint">@{friend.username}</span>
                      </p>
                      {friend.bio ? <p className="mt-0.5 text-xs text-ink-faint">{friend.bio}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {friend.myAccess === "NONE" ? (
                          <Badge>
                            <Lock size={11} />
                            Regal nicht freigegeben
                          </Badge>
                        ) : (
                          <>
                            <Badge tone="bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200">
                              {friend.myAccess === "REQUEST_LOAN" ? <HandHeart size={11} /> : <Eye size={11} />}
                              {friend.myAccess === "REQUEST_LOAN" ? "Ausleihe möglich" : "Nur ansehen"}
                            </Badge>
                            <Link
                              href={`/friends/${friend.username}`}
                              className="inline-flex items-center gap-1.5 text-xs text-clay-600 underline-offset-2 hover:underline dark:text-clay-300"
                            >
                              <BookOpen size={12} />
                              {friend.shelfName} ansehen ({pluralize(friend.sharedBookCount, "Buch", "Bücher")})
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <RemoveFriendButton friendUserId={friend.id} friendName={friend.displayName} />
                  </div>

                  <div className="mt-4 border-t border-ink/8 pt-3 dark:border-white/8">
                    <p className="mb-2 text-xs text-ink-faint">
                      Was {friend.displayName} in <span className="text-ink-soft">deinem</span> Regal darf:
                    </p>
                    <ShelfPermissionPicker
                      friendUserId={friend.id}
                      friendName={friend.displayName}
                      value={friend.grantedPermission}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="Noch keine Freunde"
              description="Suche nach Benutzernamen und schicke eine Anfrage – danach könnt ihr eure Regale gegenseitig freigeben."
              action={
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-faint">
                  <UserPlus size={15} />
                  Oben suchen und anfragen
                </span>
              }
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
