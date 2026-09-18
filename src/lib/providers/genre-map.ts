/**
 * Schlagwörter externer APIs (Open Library „subjects“, Google Books
 * „categories“) auf die eigenen Genre-Slugs abbilden.
 */
const GENRE_KEYWORDS: Record<string, string[]> = {
  romance: ["romance", "liebesroman", "love stories", "romantic", "chick lit", "liebe"],
  thriller: ["thriller", "suspense", "spionage", "espionage", "psychothriller"],
  // Nur eindeutige Begriffe: Geister und Vampire sind auch in Fantasy häufige Motive.
  horror: ["horror", "ghost stories", "gruselgeschichte", "grusel", "zombies", "schauerroman"],
  fantasy: [
    "fantasy", "magic", "magie", "magia", "zauber", "wizard", "witch", "hexe", "sorcer",
    "dragons", "drachen", "elves", "elfen", "mythical",
  ],
  mystery: ["mystery", "detective", "krimi", "kriminalroman", "whodunit", "crime", "murder"],
  scifi: ["science fiction", "sci-fi", "dystopia", "dystopie", "space opera", "cyberpunk", "zukunft"],
  historical: ["historical", "historisch", "history fiction", "20th century", "war fiction"],
  contemporary: ["contemporary", "gegenwartsliteratur", "belletristik", "fiction", "roman", "literary"],
  youngadult: ["young adult", "jugendbuch", "coming of age", "teen", "juvenile fiction"],
  nonfiction: [
    "nonfiction", "sachbuch", "essay", "science", "psychology", "psychologie",
    "philosophy", "philosophie", "business", "wirtschaft", "self-help", "ratgeber",
  ],
  biography: ["biography", "biographie", "memoir", "autobiography", "erinnerungen"],
  poetry: ["poetry", "lyrik", "gedichte", "poems"],
  classics: ["classic", "klassiker", "classics", "literature 19th century"],
  children: ["children", "kinderbuch", "picture book", "bilderbuch", "juvenile literature"],
  graphic: ["comic", "graphic novel", "manga", "comics"],
};

const GENERIC = new Set(["contemporary", "nonfiction"]);

/**
 * Zählt pro Genre, wie viele Schlagwörter passen, und behält nur Genres mit
 * deutlicher Evidenz (mindestens halb so viele Treffer wie das stärkste Genre,
 * bei mehrfach belegten Genres mindestens zwei).
 * So macht ein einzelnes „Ghosts“ aus einem Fantasy-Roman keinen Horror.
 * Generische Genres (Gegenwartsliteratur, Sachbuch) zählen nur, wenn kein
 * spezifisches Genre erkannt wurde – „Fantasy fiction“ soll Fantasy bleiben.
 */
export function mapSubjectsToGenres(subjects: (string | null | undefined)[]): string[] {
  const list = subjects.filter((s): s is string => Boolean(s)).map((s) => s.toLowerCase());
  if (!list.length) return [];

  const scored = Object.entries(GENRE_KEYWORDS)
    .map(([slug, keywords]) => ({
      slug,
      score: list.filter((subject) => keywords.some((kw) => subject.includes(kw))).length,
    }))
    .filter((entry) => entry.score > 0);

  const specific = scored.filter((entry) => !GENERIC.has(entry.slug));
  const pool = (specific.length ? specific : scored).sort((a, b) => b.score - a.score);
  if (!pool.length) return [];

  // Einzeltreffer zählen nur, wenn kein Genre mehrfach belegt ist.
  const best = pool[0].score;
  const threshold = best >= 2 ? Math.max(2, Math.ceil(best / 2)) : 1;
  return pool
    .filter((entry) => entry.score >= threshold)
    .map((entry) => entry.slug)
    .slice(0, 3);
}
