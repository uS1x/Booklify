"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { acceptFriendRequestAction, searchUsersAction, sendFriendRequestAction } from "@/server/actions/friends";
import { pluralize } from "@/lib/format";

type Result = Awaited<ReturnType<typeof searchUsersAction>>[number];

/** Benutzersuche mit direkter Freundschaftsanfrage. */
export function FriendSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const [, startAction] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const search = () =>
    startSearch(async () => {
      const found = await searchUsersAction(query);
      setResults(found);
      setSearched(true);
    });

  const request = (result: Result) =>
    startAction(async () => {
      const response =
        result.relation === "INCOMING" && result.friendshipId
          ? await acceptFriendRequestAction(result.friendshipId)
          : await sendFriendRequestAction(result.id);

      if (response.ok) {
        toast(
          result.relation === "INCOMING"
            ? `${result.displayName} ist jetzt dein Freund`
            : `Anfrage an ${result.displayName} gesendet`,
        );
        setResults((prev) =>
          prev.map((entry) =>
            entry.id === result.id
              ? { ...entry, relation: result.relation === "INCOMING" ? "FRIENDS" : "OUTGOING" }
              : entry,
          ),
        );
        router.refresh();
      } else {
        toast(response.error, "error");
      }
    });

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Benutzername, Name oder E-Mail"
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={searching || query.trim().length < 2}>
          {searching ? <Loader2 size={16} className="animate-spin" /> : "Suchen"}
        </Button>
      </form>

      {results.length ? (
        <ul className="mt-4 flex flex-col divide-y divide-ink/6 dark:divide-white/6">
          {results.map((result) => (
            <li key={result.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={result.displayName} accentColor={result.accentColor} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {result.displayName} <span className="text-ink-faint">@{result.username}</span>
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {result.bio ?? pluralize(result.bookCount, "Buch", "Bücher")}
                </p>
              </div>

              {result.relation === "FRIENDS" ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-sage-500">
                  <Check size={13} />
                  befreundet
                </span>
              ) : result.relation === "OUTGOING" ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                  <Clock size={13} />
                  Anfrage läuft
                </span>
              ) : (
                <Button
                  size="sm"
                  variant={result.relation === "INCOMING" ? "primary" : "soft"}
                  onClick={() => request(result)}
                >
                  <UserPlus size={14} />
                  {result.relation === "INCOMING" ? "Annehmen" : "Anfragen"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : searched && !searching ? (
        <p className="mt-4 text-sm text-ink-faint">
          Niemanden gefunden. E-Mail-Adressen müssen vollständig eingegeben werden.
        </p>
      ) : null}
    </div>
  );
}
