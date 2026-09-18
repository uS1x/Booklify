/**
 * Seed für Stammdaten: Genres und den datengetriebenen Fragenkatalog.
 *
 * Nicht destruktiv und beliebig oft ausführbar: Genres und Fragen werden per
 * Upsert angelegt bzw. aktualisiert. Benutzer, Bücher und alle persönlichen
 * Daten bleiben unangetastet.
 */
import { PrismaClient } from "@prisma/client";

import { GENRES, QUESTIONS } from "./seed-data";

const db = new PrismaClient();

async function main() {
  const genreIds = new Map<string, string>();
  for (const genre of GENRES) {
    const saved = await db.genre.upsert({
      where: { slug: genre.slug },
      create: genre,
      update: { name: genre.name, emoji: genre.emoji, tint: genre.tint, sortOrder: genre.sortOrder },
    });
    genreIds.set(genre.slug, saved.id);
  }

  for (const question of QUESTIONS) {
    const genreId = question.genre ? genreIds.get(question.genre) : null;
    if (question.genre && !genreId) throw new Error(`Unbekanntes Genre „${question.genre}“ in Frage ${question.key}`);

    const data = {
      prompt: question.prompt,
      hint: question.hint ?? null,
      type: question.type,
      scope: question.genre ? "GENRE" : "GENERAL",
      genreId: genreId ?? null,
      config: JSON.stringify(question.config ?? {}),
      sortOrder: question.sortOrder,
      active: true,
    };

    // Vorhandene Antworten bleiben erhalten – nur Text und Konfiguration werden aktualisiert.
    await db.question.upsert({ where: { key: question.key }, create: { key: question.key, ...data }, update: data });
  }

  console.log(`✔ Stammdaten aktuell: ${GENRES.length} Genres, ${QUESTIONS.length} Fragen`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
