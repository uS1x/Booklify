/**
 * Schlagwörter externer APIs (Open Library „subjects“, Google Books
 * „categories“) auf die eigenen Genre-Slugs abbilden.
 */
const GENRE_KEYWORDS: Record<string, string[]> = {
  romance: ["romance", "liebesroman", "love stories", "romantic", "chick lit", "liebe"],
  thriller: ["thriller", "suspense", "spionage", "espionage", "psychothriller"],
  horror: ["horror", "ghost", "geister", "grusel", "vampire", "zombie", "supernatural horror"],
  fantasy: ["fantasy", "magic", "magie", "dragons", "drachen", "epic fantasy", "mythical"],
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

export function mapSubjectsToGenres(subjects: (string | null | undefined)[]): string[] {
  const haystack = subjects
    .filter((s): s is string => Boolean(s))
    .join(" | ")
    .toLowerCase();
  if (!haystack) return [];

  const hits: string[] = [];
  for (const [slug, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) hits.push(slug);
  }
  // Sehr generische Treffer nur behalten, wenn sonst nichts passt.
  const specific = hits.filter((h) => h !== "contemporary" && h !== "nonfiction");
  const result = specific.length ? specific : hits;
  return result.slice(0, 3);
}
