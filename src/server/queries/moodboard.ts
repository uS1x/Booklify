import "server-only";

import { db } from "@/lib/db";
import type { MoodboardElementType } from "@/lib/constants";

export type MoodboardElementDTO = {
  id: string;
  type: MoodboardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  src: string | null;
  text: string | null;
  color: string | null;
  fontFamily: string | null;
  fontSize: number | null;
  meta: Record<string, unknown> | null;
};

export type MoodboardDTO = {
  id: string;
  userBookId: string;
  title: string | null;
  background: string;
  elements: MoodboardElementDTO[];
};

export type DrawingDTO = {
  id: string;
  title: string | null;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: string;
};

function parseMeta(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getMoodboard(userBookId: string): Promise<MoodboardDTO | null> {
  const board = await db.moodboard.findUnique({
    where: { userBookId },
    include: { elements: { orderBy: { zIndex: "asc" } } },
  });
  if (!board) return null;

  return {
    id: board.id,
    userBookId: board.userBookId,
    title: board.title,
    background: board.background,
    elements: board.elements.map((element) => ({
      id: element.id,
      type: element.type as MoodboardElementType,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      zIndex: element.zIndex,
      src: element.src,
      text: element.text,
      color: element.color,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      meta: parseMeta(element.meta),
    })),
  };
}

export async function getDrawings(userBookId: string): Promise<DrawingDTO[]> {
  const drawings = await db.drawing.findMany({
    where: { userBookId },
    orderBy: { createdAt: "desc" },
  });
  return drawings.map((drawing) => ({
    id: drawing.id,
    title: drawing.title,
    dataUrl: drawing.dataUrl,
    width: drawing.width,
    height: drawing.height,
    createdAt: drawing.createdAt.toISOString(),
  }));
}
