"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { requireOwnedUserBook } from "@/lib/permissions";
import { MOODBOARD_ELEMENT_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/server/actions/books";
import type { MoodboardElementDTO } from "@/server/queries/moodboard";

const geometry = {
  x: z.number().min(-4000).max(4000),
  y: z.number().min(-4000).max(4000),
  width: z.number().min(16).max(4000),
  height: z.number().min(16).max(4000),
  rotation: z.number().min(-360).max(360),
  zIndex: z.number().int().min(0).max(9999),
};

const elementSchema = z.object({
  type: z.enum(MOODBOARD_ELEMENT_TYPES),
  ...geometry,
  src: z.string().max(4000).optional().nullable(),
  text: z.string().max(2000).optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  fontFamily: z.enum(["display", "sans", "hand"]).optional().nullable(),
  fontSize: z.number().min(8).max(200).optional().nullable(),
  meta: z.record(z.unknown()).optional().nullable(),
});

const patchSchema = elementSchema.partial();

/** Legt das Moodboard beim ersten Bearbeiten automatisch an. */
async function ensureBoard(userId: string, userBookId: string) {
  await requireOwnedUserBook(userId, userBookId);
  return db.moodboard.upsert({
    where: { userBookId },
    create: { userBookId },
    update: {},
    select: { id: true },
  });
}

export async function addMoodboardElementAction(
  userBookId: string,
  input: z.input<typeof elementSchema>,
): Promise<ActionResult<MoodboardElementDTO>> {
  try {
    const user = await requireUserStrict();
    const board = await ensureBoard(user.id, userBookId);
    const data = elementSchema.parse(input);

    const created = await db.moodboardElement.create({
      data: {
        moodboardId: board.id,
        type: data.type,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        rotation: data.rotation,
        zIndex: data.zIndex,
        src: data.src ?? null,
        text: data.text ?? null,
        color: data.color ?? null,
        fontFamily: data.fontFamily ?? null,
        fontSize: data.fontSize ?? null,
        meta: data.meta ? JSON.stringify(data.meta) : null,
      },
    });

    revalidatePath(`/books/${userBookId}`);
    return {
      ok: true,
      data: {
        id: created.id,
        type: created.type as MoodboardElementDTO["type"],
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        src: created.src,
        text: created.text,
        color: created.color,
        fontFamily: created.fontFamily,
        fontSize: created.fontSize,
        meta: data.meta ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/** Mehrere Elemente in einem Rutsch aktualisieren (Verschieben, Skalieren, Drehen). */
export async function updateMoodboardElementsAction(
  userBookId: string,
  updates: { id: string; patch: z.input<typeof patchSchema> }[],
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const board = await ensureBoard(user.id, userBookId);

    for (const update of updates.slice(0, 60)) {
      const patch = patchSchema.parse(update.patch);
      const { meta, ...rest } = patch;
      await db.moodboardElement.updateMany({
        where: { id: update.id, moodboardId: board.id },
        data: {
          ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
          ...(meta !== undefined ? { meta: meta ? JSON.stringify(meta) : null } : {}),
        },
      });
    }

    revalidatePath(`/books/${userBookId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function deleteMoodboardElementAction(
  userBookId: string,
  elementId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const board = await ensureBoard(user.id, userBookId);
    await db.moodboardElement.deleteMany({ where: { id: elementId, moodboardId: board.id } });
    revalidatePath(`/books/${userBookId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function updateMoodboardAction(
  userBookId: string,
  input: { title?: string | null; background?: string },
): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const board = await ensureBoard(user.id, userBookId);
    await db.moodboard.update({
      where: { id: board.id },
      data: {
        ...(input.title !== undefined ? { title: input.title?.slice(0, 120) || null } : {}),
        ...(input.background ? { background: input.background.slice(0, 40) } : {}),
      },
    });
    revalidatePath(`/books/${userBookId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

/* ────────────────────────────────────────── Zeichnungen */

const drawingSchema = z.object({
  dataUrl: z
    .string()
    .max(6_000_000)
    .refine((value) => value.startsWith("data:image/png;base64,"), "Nur PNG-Zeichnungen"),
  title: z.string().max(120).optional().nullable(),
  width: z.number().int().min(50).max(4000),
  height: z.number().int().min(50).max(4000),
  addToBoard: z.boolean().optional(),
});

export async function saveDrawingAction(
  userBookId: string,
  input: z.input<typeof drawingSchema>,
): Promise<ActionResult<{ id: string; element: MoodboardElementDTO | null }>> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    const data = drawingSchema.parse(input);

    const drawing = await db.drawing.create({
      data: {
        userBookId,
        title: data.title || null,
        dataUrl: data.dataUrl,
        width: data.width,
        height: data.height,
      },
    });

    let element: MoodboardElementDTO | null = null;
    if (data.addToBoard) {
      const board = await ensureBoard(user.id, userBookId);
      const max = await db.moodboardElement.aggregate({
        where: { moodboardId: board.id },
        _max: { zIndex: true },
      });
      const ratio = data.height / data.width;
      const created = await db.moodboardElement.create({
        data: {
          moodboardId: board.id,
          type: "DRAWING",
          x: 120,
          y: 120,
          width: 320,
          height: Math.round(320 * ratio),
          rotation: -1.5,
          zIndex: (max._max.zIndex ?? 0) + 1,
          src: data.dataUrl,
          text: data.title || "Zeichnung",
        },
      });
      element = {
        id: created.id,
        type: "DRAWING",
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        src: created.src,
        text: created.text,
        color: null,
        fontFamily: null,
        fontSize: null,
        meta: null,
      };
    }

    revalidatePath(`/books/${userBookId}`);
    return { ok: true, data: { id: drawing.id, element } };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

export async function deleteDrawingAction(userBookId: string, drawingId: string): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    await requireOwnedUserBook(user.id, userBookId);
    await db.drawing.deleteMany({ where: { id: drawingId, userBookId } });
    revalidatePath(`/books/${userBookId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: msg(error) };
  }
}

function msg(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Ungültige Eingabe.";
  const text = error instanceof Error ? error.message : String(error);
  if (text === "UNAUTHORIZED") return "Bitte melde dich an.";
  if (text === "NOT_FOUND") return "Dieses Buch gehört nicht zu deinem Regal.";
  console.error("[moodboard]", error);
  return "Das hat nicht funktioniert. Bitte versuche es erneut.";
}
