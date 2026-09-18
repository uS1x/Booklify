"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserStrict } from "@/lib/auth";
import { ACCENT_COLORS } from "@/lib/constants";
import type { ActionResult } from "@/server/actions/books";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name ist zu kurz").max(60),
  bio: z.string().max(280).optional().nullable(),
  accentColor: z.enum(ACCENT_COLORS.map((c) => c.key) as [string, ...string[]]),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  try {
    const user = await requireUserStrict();
    const data = profileSchema.parse(input);
    await db.user.update({
      where: { id: user.id },
      data: { displayName: data.displayName, bio: data.bio?.slice(0, 280) || null, accentColor: data.accentColor },
    });
    revalidatePath("/profile");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0].message };
    return { ok: false, error: "Profil konnte nicht gespeichert werden." };
  }
}
