"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { SHELF_PERMISSIONS, VISIBILITIES } from "@/lib/constants";
import type { ActionResult } from "@/server/actions/books";

function revalidateSocial() {
  revalidatePath("/friends");
  revalidatePath("/notifications");
  revalidatePath("/profile");
  revalidatePath("/");
}

/* ────────────────────────────────────────── Freundschaftsanfragen */

export async function sendFriendRequestAction(targetUserId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    if (targetUserId === user.id) return { ok: false, error: "Du bist schon mit dir befreundet." };

    const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) return { ok: false, error: "Diesen Benutzer gibt es nicht." };

    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: user.id },
        ],
      },
    });

    if (existing?.status === "ACCEPTED") return { ok: false, error: "Ihr seid schon Freunde." };
    if (existing?.status === "PENDING") {
      // Gegenanfrage: als Annahme behandeln.
      if (existing.requesterId === targetUserId) return acceptFriendRequestAction(existing.id);
      return { ok: false, error: "Anfrage läuft bereits." };
    }

    if (existing) {
      await db.friendship.update({
        where: { id: existing.id },
        data: { status: "PENDING", requesterId: user.id, addresseeId: targetUserId, respondedAt: null },
      });
    } else {
      await db.friendship.create({
        data: { requesterId: user.id, addresseeId: targetUserId, status: "PENDING" },
      });
    }

    await notify({
      userId: targetUserId,
      type: "FRIEND_REQUEST",
      title: "Neue Freundschaftsanfrage",
      body: `${user.displayName} möchte mit dir Bücher teilen.`,
      href: "/friends",
      actorId: user.id,
    });

    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function acceptFriendRequestAction(friendshipId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const friendship = await db.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.addresseeId !== user.id || friendship.status !== "PENDING") {
      return { ok: false, error: "Diese Anfrage ist nicht mehr offen." };
    }

    await db.friendship.update({
      where: { id: friendshipId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    await notify({
      userId: friendship.requesterId,
      type: "FRIEND_ACCEPTED",
      title: "Freundschaft bestätigt",
      body: `${user.displayName} hat deine Anfrage angenommen.`,
      href: `/friends`,
      actorId: user.id,
    });

    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function declineFriendRequestAction(friendshipId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const friendship = await db.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.addresseeId !== user.id) {
      return { ok: false, error: "Diese Anfrage ist nicht mehr offen." };
    }
    await db.friendship.update({
      where: { id: friendshipId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function cancelFriendRequestAction(friendshipId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const friendship = await db.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.requesterId !== user.id || friendship.status !== "PENDING") {
      return { ok: false, error: "Diese Anfrage ist nicht mehr offen." };
    }
    await db.friendship.delete({ where: { id: friendshipId } });
    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/** Freundschaft auflösen: inklusive Regal-Freigaben und offener Anfragen. */
export async function removeFriendAction(friendUserId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await db.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: friendUserId },
          { requesterId: friendUserId, addresseeId: user.id },
        ],
      },
    });

    const shelves = await db.sharedShelf.findMany({
      where: { ownerId: { in: [user.id, friendUserId] } },
      select: { id: true },
    });
    await db.sharedShelfMember.deleteMany({
      where: { shelfId: { in: shelves.map((s) => s.id) }, userId: { in: [user.id, friendUserId] } },
    });
    await db.loanRequest.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { requesterId: user.id, ownerId: friendUserId },
          { requesterId: friendUserId, ownerId: user.id },
        ],
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });

    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/* ────────────────────────────────────────── Regal teilen */

export async function updateShelfSettingsAction(input: {
  name?: string;
  description?: string;
  visibility?: "PRIVATE" | "FRIENDS";
}): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const parsed = z
      .object({
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(280).optional(),
        visibility: z.enum(VISIBILITIES).optional(),
      })
      .parse(input);

    await db.sharedShelf.upsert({
      where: { ownerId: user.id },
      create: { ownerId: user.id, name: parsed.name ?? "Mein Bücherregal", visibility: parsed.visibility ?? "PRIVATE" },
      update: parsed,
    });

    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/** Berechtigung für einen einzelnen Freund setzen (oder mit null entziehen). */
export async function setShelfMemberAction(
  friendUserId: string,
  permission: "VIEW" | "REQUEST_LOAN" | null,
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    if (permission !== null) z.enum(SHELF_PERMISSIONS).parse(permission);

    const friendship = await db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: user.id, addresseeId: friendUserId },
          { requesterId: friendUserId, addresseeId: user.id },
        ],
      },
      select: { id: true },
    });
    if (!friendship) return { ok: false, error: "Ihr seid keine Freunde." };

    const shelf = await db.sharedShelf.upsert({
      where: { ownerId: user.id },
      create: { ownerId: user.id },
      update: {},
      select: { id: true },
    });

    if (permission === null) {
      await db.sharedShelfMember.deleteMany({ where: { shelfId: shelf.id, userId: friendUserId } });
    } else {
      await db.sharedShelfMember.upsert({
        where: { shelfId_userId: { shelfId: shelf.id, userId: friendUserId } },
        create: { shelfId: shelf.id, userId: friendUserId, permission },
        update: { permission },
      });
      await notify({
        userId: friendUserId,
        type: "SHELF_SHARED",
        title: "Regal freigegeben",
        body:
          permission === "REQUEST_LOAN"
            ? `${user.displayName} teilt sein Regal mit dir – Ausleihen sind möglich.`
            : `${user.displayName} teilt sein Regal mit dir.`,
        href: `/friends/${user.username}`,
        actorId: user.id,
      });
    }

    revalidateSocial();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/** Benutzersuche für Freundschaftsanfragen. */
export async function searchUsersAction(query: string) {
  const user = await requireUserStrict();
  const q = query.trim();
  if (q.length < 2) return [];

  const users = await db.user.findMany({
    where: {
      id: { not: user.id },
      OR: [{ username: { contains: q } }, { displayName: { contains: q } }, { email: q.toLowerCase() }],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      accentColor: true,
      bio: true,
      _count: { select: { books: true } },
      sentFriendships: { where: { addresseeId: user.id }, select: { id: true, status: true } },
      receivedFriendships: { where: { requesterId: user.id }, select: { id: true, status: true } },
    },
    take: 12,
  });

  return users.map((u) => {
    const incoming = u.sentFriendships[0];
    const outgoing = u.receivedFriendships[0];
    const relation =
      incoming?.status === "ACCEPTED" || outgoing?.status === "ACCEPTED"
        ? "FRIENDS"
        : incoming?.status === "PENDING"
          ? "INCOMING"
          : outgoing?.status === "PENDING"
            ? "OUTGOING"
            : "NONE";
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      accentColor: u.accentColor,
      bio: u.bio,
      bookCount: u._count.books,
      relation,
      friendshipId: incoming?.id ?? outgoing?.id ?? null,
    };
  });
}

function msg(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Ungültige Eingabe.";
  const text = error instanceof Error ? error.message : String(error);
  if (text === "UNAUTHORIZED") return "Bitte melde dich an.";
  console.error("[friends]", error);
  return "Das hat nicht funktioniert. Bitte versuche es erneut.";
}
