import "server-only";

import { db } from "@/lib/db";
import { getShelfAccess, type ShelfAccess } from "@/lib/permissions";
import type { ShelfPermission } from "@/lib/constants";

export type FriendCard = {
  id: string;
  username: string;
  displayName: string;
  accentColor: string;
  bio: string | null;
  friendshipId: string;
  since: string | null;
  /** Was ich diesem Freund von meinem Regal erlaube. */
  grantedPermission: ShelfPermission | "NONE";
  /** Was ich in seinem Regal darf. */
  myAccess: ShelfAccess;
  sharedBookCount: number;
  shelfName: string;
};

export type PendingRequest = {
  id: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string; accentColor: string; bio: string | null };
};

/** Freunde, offene Anfragen und die jeweiligen Berechtigungen. */
export async function getFriendsOverview(userId: string) {
  const [friendships, myShelf] = await Promise.all([
    db.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: {
        requester: { select: { id: true, username: true, displayName: true, accentColor: true, bio: true } },
        addressee: { select: { id: true, username: true, displayName: true, accentColor: true, bio: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.sharedShelf.findUnique({
      where: { ownerId: userId },
      select: { id: true, name: true, visibility: true, members: { select: { userId: true, permission: true } } },
    }),
  ]);

  const grants = new Map(myShelf?.members.map((m) => [m.userId, m.permission as ShelfPermission]) ?? []);

  const accepted = friendships.filter((f) => f.status === "ACCEPTED");
  const friends: FriendCard[] = await Promise.all(
    accepted.map(async (friendship) => {
      const other = friendship.requesterId === userId ? friendship.addressee : friendship.requester;
      const [access, shelf, sharedBookCount] = await Promise.all([
        getShelfAccess(userId, other.id),
        db.sharedShelf.findUnique({ where: { ownerId: other.id }, select: { name: true } }),
        db.userBook.count({ where: { userId: other.id, visibility: "FRIENDS" } }),
      ]);

      return {
        id: other.id,
        username: other.username,
        displayName: other.displayName,
        accentColor: other.accentColor,
        bio: other.bio,
        friendshipId: friendship.id,
        since: friendship.respondedAt?.toISOString() ?? friendship.createdAt.toISOString(),
        grantedPermission: grants.get(other.id) ?? (myShelf?.visibility === "FRIENDS" ? "VIEW" : "NONE"),
        myAccess: access,
        sharedBookCount,
        shelfName: shelf?.name ?? `Regal von ${other.displayName}`,
      };
    }),
  );

  const incoming: PendingRequest[] = friendships
    .filter((f) => f.status === "PENDING" && f.addresseeId === userId)
    .map((f) => ({ id: f.id, createdAt: f.createdAt.toISOString(), user: f.requester }));

  const outgoing: PendingRequest[] = friendships
    .filter((f) => f.status === "PENDING" && f.requesterId === userId)
    .map((f) => ({ id: f.id, createdAt: f.createdAt.toISOString(), user: f.addressee }));

  return {
    friends: friends.sort((a, b) => a.displayName.localeCompare(b.displayName, "de")),
    incoming,
    outgoing,
    shelf: myShelf
      ? { name: myShelf.name, visibility: myShelf.visibility as "PRIVATE" | "FRIENDS" }
      : { name: "Mein Bücherregal", visibility: "PRIVATE" as const },
  };
}

/** Regal eines Freundes – inklusive serverseitiger Zugriffsprüfung. */
export async function getFriendShelf(viewerId: string, username: string) {
  const owner = await db.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, displayName: true, accentColor: true, bio: true, createdAt: true,
      shelf: { select: { name: true, description: true, visibility: true } },
    },
  });
  if (!owner) return null;

  const access = await getShelfAccess(viewerId, owner.id);
  return { owner, access };
}
