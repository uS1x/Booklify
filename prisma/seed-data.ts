/** Genres, Fragenkatalog und Demo-Bücher – Datenbasis für prisma/seed.ts. */

export const GENRES = [
  { slug: "romance", name: "Romance", emoji: "💗", tint: "#f2cec8", sortOrder: 10 },
  { slug: "thriller", name: "Thriller", emoji: "🔪", tint: "#bed1de", sortOrder: 20 },
  { slug: "horror", name: "Horror", emoji: "🕯️", tint: "#c9b7c9", sortOrder: 30 },
  { slug: "fantasy", name: "Fantasy", emoji: "🐉", tint: "#d6c2d7", sortOrder: 40 },
  { slug: "mystery", name: "Mystery & Krimi", emoji: "🔍", tint: "#c9d8c5", sortOrder: 50 },
  { slug: "scifi", name: "Science-Fiction", emoji: "🚀", tint: "#bed1de", sortOrder: 60 },
  { slug: "historical", name: "Historisch", emoji: "🏛️", tint: "#e3cdb4", sortOrder: 70 },
  { slug: "contemporary", name: "Gegenwartsliteratur", emoji: "🪴", tint: "#e6ede4", sortOrder: 80 },
  { slug: "youngadult", name: "Young Adult", emoji: "🌈", tint: "#fae9e6", sortOrder: 90 },
  { slug: "nonfiction", name: "Sachbuch", emoji: "🧠", tint: "#f5d9a8", sortOrder: 100 },
  { slug: "biography", name: "Biografie", emoji: "🪞", tint: "#ebc0b1", sortOrder: 110 },
  { slug: "poetry", name: "Lyrik", emoji: "🕊️", tint: "#ece3ec", sortOrder: 120 },
  { slug: "classics", name: "Klassiker", emoji: "📜", tint: "#e8d9c5", sortOrder: 130 },
  { slug: "children", name: "Kinderbuch", emoji: "🧸", tint: "#fbecd2", sortOrder: 140 },
  { slug: "graphic", name: "Graphic Novel", emoji: "🎨", tint: "#c9d8c5", sortOrder: 150 },
];

type QuestionSeed = {
  key: string;
  prompt: string;
  hint?: string;
  type: "RATING_5" | "RATING_10" | "SLIDER" | "YES_NO" | "CHOICE" | "TEXT" | "TAGS";
  genre?: string;
  sortOrder: number;
  config?: Record<string, unknown>;
};

/** Allgemeine Fragen – gelten für jedes Buch. */
const GENERAL_QUESTIONS: QuestionSeed[] = [
  { key: "overall", prompt: "Wie fandest du das Buch?", type: "RATING_10", sortOrder: 10,
    config: { lowLabel: "gar nicht", highLabel: "fantastisch" } },
  { key: "excitement", prompt: "Wie spannend war es?", type: "RATING_5", sortOrder: 20 },
  { key: "emotional", prompt: "Wie emotional war es?", type: "RATING_5", sortOrder: 30 },
  { key: "characters", prompt: "Wie gut waren die Charaktere?", type: "RATING_5", sortOrder: 40 },
  { key: "plot", prompt: "Wie gut war die Handlung?", type: "RATING_5", sortOrder: 50 },
  { key: "readability", prompt: "Wie leicht ließ es sich lesen?", type: "RATING_5", sortOrder: 60 },
  { key: "recommend", prompt: "Würdest du es weiterempfehlen?", type: "YES_NO", sortOrder: 70 },
  { key: "reread", prompt: "Würdest du es erneut lesen?", type: "YES_NO", sortOrder: 80 },
  { key: "pace", prompt: "Wie war das Lesetempo?", type: "SLIDER", sortOrder: 90,
    config: { min: 0, max: 100, step: 5, lowLabel: "gemächlich", highLabel: "rasant", unit: "" } },
  { key: "reading-place", prompt: "Wo hast du es meistens gelesen?", type: "CHOICE", sortOrder: 100,
    config: { options: ["Im Bett", "Auf dem Sofa", "In der Bahn", "Im Café", "Im Garten", "Am Strand", "In der Badewanne"], multiple: true } },
  { key: "mood-tags", prompt: "Welche Stimmung hatte das Buch?", type: "TAGS", sortOrder: 110,
    config: { suggestions: ["cozy", "melancholisch", "düster", "hoffnungsvoll", "witzig", "nachdenklich", "atemlos", "warm"] } },
  { key: "favorite-quote", prompt: "Gibt es eine Stelle, die du behalten möchtest?", type: "TEXT", sortOrder: 120,
    config: { placeholder: "Lieblingszitat oder Szene …", rows: 3 } },
  { key: "feeling-after", prompt: "Wie hast du dich nach der letzten Seite gefühlt?", type: "TEXT", sortOrder: 130,
    config: { placeholder: "Ein paar Zeilen für dein Buch-Tagebuch …", rows: 3 } },
];

/** Genreabhängige Fragen – werden anhand der Genres des Buches ausgewählt. */
const GENRE_QUESTIONS: QuestionSeed[] = [
  // Romance
  { key: "romance-romantic", genre: "romance", prompt: "Wie romantisch war das Buch?", type: "RATING_5", sortOrder: 200 },
  { key: "romance-chemistry", genre: "romance", prompt: "Wie gut war die Chemie?", type: "RATING_5", sortOrder: 210 },
  { key: "romance-sweetness", genre: "romance", prompt: "Wie süß war die Beziehung?", type: "RATING_5", sortOrder: 220 },
  { key: "romance-emotion", genre: "romance", prompt: "Wie emotional war die Romance?", type: "RATING_5", sortOrder: 230 },
  { key: "romance-ending", genre: "romance", prompt: "Wie zufriedenstellend war das Ende?", type: "RATING_5", sortOrder: 240 },
  { key: "romance-trope", genre: "romance", prompt: "Welches Trope war es?", type: "CHOICE", sortOrder: 250,
    config: { options: ["Friends to Lovers", "Enemies to Lovers", "Second Chance", "Fake Dating", "Slow Burn", "Forbidden Love"], multiple: true } },

  // Thriller
  { key: "thriller-tension", genre: "thriller", prompt: "Wie spannend?", type: "RATING_5", sortOrder: 300 },
  { key: "thriller-twists", genre: "thriller", prompt: "Wie überraschend waren die Wendungen?", type: "RATING_5", sortOrder: 310 },
  { key: "thriller-unpredictable", genre: "thriller", prompt: "Wie unvorhersehbar?", type: "RATING_5", sortOrder: 320 },
  { key: "thriller-nerves", genre: "thriller", prompt: "Wie nervenaufreibend?", type: "RATING_5", sortOrder: 330 },
  { key: "thriller-guessed", genre: "thriller", prompt: "Hast du das Ende geahnt?", type: "YES_NO", sortOrder: 340 },

  // Horror
  { key: "horror-scary", genre: "horror", prompt: "Wie gruselig?", type: "RATING_5", sortOrder: 400 },
  { key: "horror-dark", genre: "horror", prompt: "Wie düster?", type: "RATING_5", sortOrder: 410 },
  { key: "horror-disturbing", genre: "horror", prompt: "Wie verstörend?", type: "RATING_5", sortOrder: 420 },
  { key: "horror-atmosphere", genre: "horror", prompt: "Wie stark war die Atmosphäre?", type: "RATING_5", sortOrder: 430 },
  { key: "horror-light-on", genre: "horror", prompt: "Hast du danach das Licht angelassen?", type: "YES_NO", sortOrder: 440 },

  // Fantasy
  { key: "fantasy-worldbuilding", genre: "fantasy", prompt: "Wie gut war das Worldbuilding?", type: "RATING_5", sortOrder: 500 },
  { key: "fantasy-creativity", genre: "fantasy", prompt: "Wie kreativ war die Welt?", type: "RATING_5", sortOrder: 510 },
  { key: "fantasy-elements", genre: "fantasy", prompt: "Wie interessant waren die Fantasy-Elemente?", type: "RATING_5", sortOrder: 520 },
  { key: "fantasy-magic-system", genre: "fantasy", prompt: "Wie überzeugend war das Magiesystem?", type: "RATING_5", sortOrder: 530 },
  { key: "fantasy-map", genre: "fantasy", prompt: "Hast du die Karte im Buch benutzt?", type: "YES_NO", sortOrder: 540 },

  // Mystery / Krimi
  { key: "mystery-clues", genre: "mystery", prompt: "Wie gut waren die Hinweise?", type: "RATING_5", sortOrder: 600 },
  { key: "mystery-resolution", genre: "mystery", prompt: "Wie überraschend war die Auflösung?", type: "RATING_5", sortOrder: 610 },
  { key: "mystery-guessed", genre: "mystery", prompt: "Hast du den Täter erraten?", type: "YES_NO", sortOrder: 620 },
  { key: "mystery-detective", genre: "mystery", prompt: "Wie sympathisch war die Ermittlerfigur?", type: "RATING_5", sortOrder: 630 },

  // Science-Fiction
  { key: "scifi-ideas", genre: "scifi", prompt: "Wie originell waren die Ideen?", type: "RATING_5", sortOrder: 700 },
  { key: "scifi-plausibility", genre: "scifi", prompt: "Wie plausibel war die Zukunftsvision?", type: "RATING_5", sortOrder: 710 },
  { key: "scifi-tech", genre: "scifi", prompt: "Wie faszinierend war die Technik?", type: "RATING_5", sortOrder: 720 },

  // Sachbuch
  { key: "nonfiction-learning", genre: "nonfiction", prompt: "Wie viel hast du gelernt?", type: "RATING_5", sortOrder: 800 },
  { key: "nonfiction-practical", genre: "nonfiction", prompt: "Wie gut lässt es sich anwenden?", type: "RATING_5", sortOrder: 810 },
  { key: "nonfiction-takeaway", genre: "nonfiction", prompt: "Was ist deine wichtigste Erkenntnis?", type: "TEXT", sortOrder: 820,
    config: { placeholder: "Eine Erkenntnis, die bleibt …", rows: 3 } },

  // Historisch
  { key: "historical-era", genre: "historical", prompt: "Wie lebendig war die Epoche?", type: "RATING_5", sortOrder: 900 },
  { key: "historical-authentic", genre: "historical", prompt: "Wie authentisch hat es sich angefühlt?", type: "RATING_5", sortOrder: 910 },

  // Young Adult
  { key: "ya-relatable", genre: "youngadult", prompt: "Wie nahbar waren die Figuren?", type: "RATING_5", sortOrder: 1000 },
  { key: "ya-nostalgia", genre: "youngadult", prompt: "Wie sehr hat es dich an früher erinnert?", type: "RATING_5", sortOrder: 1010 },

  // Klassiker
  { key: "classics-timeless", genre: "classics", prompt: "Wie zeitlos ist es?", type: "RATING_5", sortOrder: 1100 },
  { key: "classics-language", genre: "classics", prompt: "Wie schön war die Sprache?", type: "RATING_5", sortOrder: 1110 },

  // Lyrik
  { key: "poetry-imagery", genre: "poetry", prompt: "Wie stark waren die Bilder?", type: "RATING_5", sortOrder: 1200 },
  { key: "poetry-favorite", genre: "poetry", prompt: "Welches Gedicht bleibt?", type: "TEXT", sortOrder: 1210, config: { rows: 2 } },

  // Graphic Novel
  { key: "graphic-art", genre: "graphic", prompt: "Wie schön waren die Zeichnungen?", type: "RATING_5", sortOrder: 1300 },
  { key: "graphic-panels", genre: "graphic", prompt: "Wie gut war das Panel-Layout?", type: "RATING_5", sortOrder: 1310 },

  // Biografie
  { key: "biography-inspiring", genre: "biography", prompt: "Wie inspirierend war es?", type: "RATING_5", sortOrder: 1400 },
  { key: "biography-honest", genre: "biography", prompt: "Wie ehrlich wirkte die Erzählung?", type: "RATING_5", sortOrder: 1410 },

  // Kinderbuch
  { key: "children-readaloud", genre: "children", prompt: "Wie gut lässt es sich vorlesen?", type: "RATING_5", sortOrder: 1500 },
];

export const QUESTIONS = [...GENERAL_QUESTIONS, ...GENRE_QUESTIONS];

export type BookSeed = {
  slug: string;
  title: string;
  author: string;
  year: number;
  pages: number;
  language: string;
  publisher: string;
  genres: string[];
  isbn13?: string;
  blurb: string;
};

/** Demo-Bibliothek. Cover/ISBN werden beim Seed über Open Library angereichert. */
export const BOOKS: BookSeed[] = [
  { slug: "name-des-windes", title: "Der Name des Windes", author: "Patrick Rothfuss", year: 2007, pages: 872,
    language: "de", publisher: "Klett-Cotta", genres: ["fantasy"],
    blurb: "Kvothe erzählt sein eigenes Leben: vom Straßenkind zum berüchtigtsten Magier seiner Zeit." },
  { slug: "harry-potter-1", title: "Harry Potter und der Stein der Weisen", author: "J. K. Rowling", year: 1997, pages: 336,
    language: "de", publisher: "Carlsen", genres: ["fantasy", "children"],
    blurb: "Ein Junge unter der Treppe erfährt an seinem elften Geburtstag, dass er ein Zauberer ist." },
  { slug: "gone-girl", title: "Gone Girl", author: "Gillian Flynn", year: 2012, pages: 576,
    language: "de", publisher: "Fischer", genres: ["thriller", "mystery"],
    blurb: "Am fünften Hochzeitstag verschwindet Amy. Was danach erzählt wird, ist selten die Wahrheit." },
  { slug: "es", title: "Es", author: "Stephen King", year: 1986, pages: 1536,
    language: "de", publisher: "Heyne", genres: ["horror"],
    blurb: "Sieben Freunde in Derry, Maine – und etwas, das alle 27 Jahre zurückkehrt." },
  { slug: "mord-orientexpress", title: "Mord im Orientexpress", author: "Agatha Christie", year: 1934, pages: 288,
    language: "de", publisher: "Atlantik", genres: ["mystery", "classics"],
    blurb: "Ein Zug im Schnee, dreizehn Reisende, eine Leiche – und Hercule Poirot." },
  { slug: "der-marsianer", title: "Der Marsianer", author: "Andy Weir", year: 2014, pages: 512,
    language: "de", publisher: "Heyne", genres: ["scifi"],
    blurb: "Allein auf dem Mars, mit Kartoffeln, Klebeband und beeindruckend viel Sarkasmus." },
  { slug: "normal-people", title: "Normal People", author: "Sally Rooney", year: 2018, pages: 320,
    language: "de", publisher: "Luchterhand", genres: ["contemporary", "romance"],
    blurb: "Connell und Marianne, immer wieder, über Jahre – und nie zum richtigen Zeitpunkt." },
  { slug: "stolz-und-vorurteil", title: "Stolz und Vorurteil", author: "Jane Austen", year: 1813, pages: 480,
    language: "de", publisher: "dtv", genres: ["classics", "romance"],
    blurb: "Elizabeth Bennet, Mr. Darcy und die Kunst, sich gründlich zu irren." },
  { slug: "sapiens", title: "Eine kurze Geschichte der Menschheit", author: "Yuval Noah Harari", year: 2011, pages: 528,
    language: "de", publisher: "Pantheon", genres: ["nonfiction"],
    blurb: "Wie aus einer unauffälligen Affenart die bestimmende Kraft des Planeten wurde." },
  { slug: "der-schwarm", title: "Der Schwarm", author: "Frank Schätzing", year: 2004, pages: 1000,
    language: "de", publisher: "Kiepenheuer & Witsch", genres: ["thriller", "scifi"],
    blurb: "Das Meer beginnt zurückzuschlagen – und niemand versteht, warum." },
  { slug: "die-unendliche-geschichte", title: "Die unendliche Geschichte", author: "Michael Ende", year: 1979, pages: 480,
    language: "de", publisher: "Thienemann", genres: ["fantasy", "children"],
    blurb: "Bastian liest ein Buch, das ihn liest." },
  { slug: "shining", title: "Shining", author: "Stephen King", year: 1977, pages: 512,
    language: "de", publisher: "Heyne", genres: ["horror", "thriller"],
    blurb: "Ein leeres Hotel im Schnee, ein Vater mit Schreibblockade, ein Kind, das zu viel sieht." },
  { slug: "beach-read", title: "Beach Read", author: "Emily Henry", year: 2020, pages: 400,
    language: "de", publisher: "Heyne", genres: ["romance", "contemporary"],
    blurb: "Zwei blockierte Autoren, zwei Strandhäuser, eine sehr schlechte Idee: Genretausch." },
  { slug: "der-grosse-gatsby", title: "Der große Gatsby", author: "F. Scott Fitzgerald", year: 1925, pages: 224,
    language: "de", publisher: "Reclam", genres: ["classics", "contemporary"],
    blurb: "Ein Mann gibt Partys für eine Frau, die nie kommt." },
  { slug: "project-hail-mary", title: "Der Astronaut", author: "Andy Weir", year: 2021, pages: 560,
    language: "de", publisher: "Heyne", genres: ["scifi"],
    blurb: "Ryland Grace wacht allein in einem Raumschiff auf und weiß nicht, warum." },
  { slug: "tintenherz", title: "Tintenherz", author: "Cornelia Funke", year: 2003, pages: 576,
    language: "de", publisher: "Dressler", genres: ["fantasy", "youngadult"],
    blurb: "Meggies Vater kann Figuren aus Büchern herauslesen. Leider auch die falschen." },
  { slug: "die-therapie", title: "Die Therapie", author: "Sebastian Fitzek", year: 2006, pages: 368,
    language: "de", publisher: "Droemer Knaur", genres: ["thriller"],
    blurb: "Ein Psychiater, dessen Tochter verschwand, und eine Patientin mit derselben Geschichte." },
  { slug: "kafka-am-strand", title: "Kafka am Strand", author: "Haruki Murakami", year: 2002, pages: 640,
    language: "de", publisher: "DuMont", genres: ["contemporary", "fantasy"],
    blurb: "Ein Junge auf der Flucht, ein alter Mann, der mit Katzen spricht, und ein Fluch." },
  { slug: "persepolis", title: "Persepolis", author: "Marjane Satrapi", year: 2000, pages: 352,
    language: "de", publisher: "Edition Moderne", genres: ["graphic", "biography"],
    blurb: "Aufwachsen in Teheran, erzählt in Schwarz und Weiß." },
  { slug: "die-1-prozent-methode", title: "Die 1%-Methode", author: "James Clear", year: 2018, pages: 352,
    language: "de", publisher: "Goldmann", genres: ["nonfiction"],
    blurb: "Kleine Gewohnheiten, große Wirkung – ein System statt guter Vorsätze." },
  { slug: "verwandlung", title: "Die Verwandlung", author: "Franz Kafka", year: 1915, pages: 96,
    language: "de", publisher: "Reclam", genres: ["classics"],
    blurb: "Gregor Samsa erwacht und ist nicht mehr, was er war." },
  { slug: "milch-und-honig", title: "Milch und Honig", author: "Rupi Kaur", year: 2014, pages: 208,
    language: "de", publisher: "Lago", genres: ["poetry"],
    blurb: "Gedichte über Verlust, Heilung und die eigene Stimme." },
];
