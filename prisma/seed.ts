/**
 * Seed: Genres, Fragenkatalog und eine vollständige Demo-Bibliothek
 * (4 Benutzer, Freundschaften, geteilte Regale, laufende Ausleihen,
 * Historie, Moodboards, Benachrichtigungen).
 *
 * Buchdaten werden – falls erreichbar – über Open Library angereichert,
 * damit echte Cover, ISBNs und Seitenzahlen vorhanden sind. Ohne Internet
 * greift der Seed auf die statischen Werte aus seed-data.ts zurück.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

import { BOOKS, GENRES, QUESTIONS, type BookSeed } from "./seed-data";

const scrypt = promisify(scryptCb);
const db = new PrismaClient();

const DEMO_PASSWORD = "lesen1234";

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password.normalize("NFKC"), salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400_000);

/* ────────────────────────────────────────── Open-Library-Anreicherung */

type Enriched = { coverUrl: string | null; isbn13: string | null; isbn10: string | null; pages: number | null; externalId: string | null };

async function enrich(book: BookSeed): Promise<Enriched> {
  const empty: Enriched = { coverUrl: null, isbn13: book.isbn13 ?? null, isbn10: null, pages: null, externalId: null };
  const params = new URLSearchParams({
    title: book.title,
    author: book.author,
    fields: "key,title,author_name,cover_i,isbn,number_of_pages_median",
    limit: "5",
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "DigitalesBuecherregal-Seed/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      docs?: { key?: string; cover_i?: number; isbn?: string[]; number_of_pages_median?: number }[];
    };
    const doc = data.docs?.find((d) => d.cover_i) ?? data.docs?.[0];
    if (!doc) return empty;
    const isbns = doc.isbn ?? [];
    return {
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      isbn13: isbns.find((i) => i.length === 13) ?? book.isbn13 ?? null,
      isbn10: isbns.find((i) => i.length === 10) ?? null,
      pages: doc.number_of_pages_median ?? null,
      externalId: doc.key?.replace("/works/", "") ?? null,
    };
  } catch {
    return empty;
  }
}

/* ────────────────────────────────────────── Aufräumen */

async function reset() {
  await db.$transaction([
    db.notification.deleteMany(),
    db.pushSubscription.deleteMany(),
    db.notificationPreference.deleteMany(),
    db.loanHistory.deleteMany(),
    db.loan.deleteMany(),
    db.loanRequest.deleteMany(),
    db.sharedShelfMember.deleteMany(),
    db.sharedShelf.deleteMany(),
    db.friendship.deleteMany(),
    db.moodboardElement.deleteMany(),
    db.moodboard.deleteMany(),
    db.drawing.deleteMany(),
    db.mediaAsset.deleteMany(),
    db.readingProgress.deleteMany(),
    db.questionAnswer.deleteMany(),
    db.bookTag.deleteMany(),
    db.tag.deleteMany(),
    db.userBook.deleteMany(),
    db.bookGenre.deleteMany(),
    db.book.deleteMany(),
    db.question.deleteMany(),
    db.genre.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);
}

/* ────────────────────────────────────────── Seed */

async function main() {
  console.log("→ Datenbank leeren …");
  await reset();

  console.log("→ Genres …");
  const genreIds = new Map<string, string>();
  for (const g of GENRES) {
    const genre = await db.genre.create({ data: g });
    genreIds.set(g.slug, genre.id);
  }

  console.log("→ Fragenkatalog …");
  for (const q of QUESTIONS) {
    await db.question.create({
      data: {
        key: q.key,
        prompt: q.prompt,
        hint: q.hint ?? null,
        type: q.type,
        scope: q.genre ? "GENRE" : "GENERAL",
        genreId: q.genre ? genreIds.get(q.genre)! : null,
        config: JSON.stringify(q.config ?? {}),
        sortOrder: q.sortOrder,
      },
    });
  }
  console.log(`   ${QUESTIONS.length} Fragen angelegt`);

  console.log("→ Bücher (Metadaten von Open Library) …");
  const bookIds = new Map<string, string>();
  const bookPages = new Map<string, number>();
  for (const seed of BOOKS) {
    const extra = await enrich(seed);
    const pages = extra.pages && extra.pages > 40 ? extra.pages : seed.pages;
    const book = await db.book.create({
      data: {
        title: seed.title,
        author: seed.author,
        description: seed.blurb,
        coverUrl: extra.coverUrl,
        isbn13: extra.isbn13,
        isbn10: extra.isbn10,
        publishedYear: seed.year,
        publishedDate: String(seed.year),
        publisher: seed.publisher,
        pageCount: pages,
        language: seed.language,
        externalSource: extra.externalId ? "openlibrary" : "manual",
        externalId: extra.externalId,
        genres: {
          create: seed.genres.map((slug) => ({ genreId: genreIds.get(slug)! })),
        },
      },
    });
    bookIds.set(seed.slug, book.id);
    bookPages.set(seed.slug, pages);
    process.stdout.write(extra.coverUrl ? "●" : "○");
  }
  console.log(`\n   ${BOOKS.length} Bücher angelegt`);

  console.log("→ Benutzer …");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const mkUser = async (
    username: string,
    displayName: string,
    accentColor: string,
    bio: string,
    shelfVisibility: string,
    shelfName: string,
  ) => {
    const user = await db.user.create({
      data: {
        username,
        displayName,
        email: `${username}@buchregal.app`,
        passwordHash,
        accentColor,
        bio,
        shelf: { create: { name: shelfName, visibility: shelfVisibility, description: bio } },
        notificationPrefs: { create: { pushEnabled: false } },
      },
    });
    return user;
  };

  const basti = await mkUser("basti", "Basti", "clay", "Liest abends drei Bücher parallel und keines zu Ende. Meistens.", "FRIENDS", "Bastis Bücherregal");
  const max = await mkUser("max", "Max Köhler", "sage", "Thriller, Kaffee, und eine Schwäche für dicke Fantasy-Bände.", "FRIENDS", "Max’ Regal");
  const lisa = await mkUser("lisa", "Lisa Brandt", "plum", "Romance mit Anspruch. Und Lyrik für den Rest.", "PRIVATE", "Lisas Bibliothek");
  const jonas = await mkUser("jonas", "Jonas Weber", "ocean", "Sachbücher, Podcasts, zu viele Notizen.", "PRIVATE", "Jonas’ Regal");

  console.log("→ Freundschaften & geteilte Regale …");
  await db.friendship.createMany({
    data: [
      { requesterId: basti.id, addresseeId: max.id, status: "ACCEPTED", createdAt: daysAgo(120), respondedAt: daysAgo(119) },
      { requesterId: lisa.id, addresseeId: basti.id, status: "ACCEPTED", createdAt: daysAgo(64), respondedAt: daysAgo(63) },
      { requesterId: max.id, addresseeId: lisa.id, status: "ACCEPTED", createdAt: daysAgo(40), respondedAt: daysAgo(39) },
      { requesterId: jonas.id, addresseeId: basti.id, status: "PENDING", createdAt: daysAgo(1) },
    ],
  });

  const shelfOf = async (userId: string) =>
    (await db.sharedShelf.findUniqueOrThrow({ where: { ownerId: userId } })).id;

  const bastiShelf = await shelfOf(basti.id);
  const maxShelf = await shelfOf(max.id);
  const lisaShelf = await shelfOf(lisa.id);

  await db.sharedShelfMember.createMany({
    data: [
      { shelfId: maxShelf, userId: basti.id, permission: "REQUEST_LOAN" },
      { shelfId: maxShelf, userId: lisa.id, permission: "VIEW" },
      { shelfId: bastiShelf, userId: max.id, permission: "REQUEST_LOAN" },
      { shelfId: bastiShelf, userId: lisa.id, permission: "REQUEST_LOAN" },
      { shelfId: lisaShelf, userId: basti.id, permission: "VIEW" },
    ],
  });

  console.log("→ Exemplare, Notizen, Fortschritt …");

  type Copy = {
    slug: string;
    status: string;
    rating?: number;
    page?: number;
    notes?: string;
    tags?: string[];
    favorite?: boolean;
    visibility?: string;
    lending?: boolean;
    started?: number;
    finished?: number;
    minutes?: number;
    addedAgo: number;
  };

  const library: Record<string, Copy[]> = {
    [basti.id]: [
      { slug: "name-des-windes", status: "READING", page: 412, addedAgo: 30, visibility: "FRIENDS", lending: true,
        tags: ["dicker-schmöker", "abends"], notes: "Die Sprache ist Musik. Ich lese absichtlich langsam.", started: 24 },
      { slug: "der-schwarm", status: "READING", page: 238, addedAgo: 14, visibility: "FRIENDS",
        notes: "Von Max geliehen – bis Ende des Monats fertig werden!", started: 12 },
      { slug: "gone-girl", status: "READ", rating: 9, addedAgo: 210, visibility: "FRIENDS", lending: true, favorite: true,
        tags: ["twist", "unzuverlässig"], notes: "Die zweite Hälfte habe ich in einer Nacht gelesen.",
        started: 200, finished: 194, minutes: 640 },
      { slug: "der-marsianer", status: "READ", rating: 8, addedAgo: 300, visibility: "FRIENDS", lending: true,
        tags: ["humor", "urlaub"], started: 290, finished: 283, minutes: 520 },
      { slug: "harry-potter-1", status: "READ", rating: 10, addedAgo: 400, visibility: "FRIENDS", lending: true, favorite: true,
        tags: ["kindheit", "comfort-read"], notes: "Zum vierten Mal. Immer noch perfekt.", started: 380, finished: 374, minutes: 300 },
      { slug: "es", status: "ABANDONED", rating: 5, addedAgo: 150, visibility: "PRIVATE", page: 380,
        notes: "1536 Seiten sind eine Lebensentscheidung. Vielleicht nächsten Winter.", started: 140 },
      { slug: "sapiens", status: "READ", rating: 8, addedAgo: 260, visibility: "FRIENDS", lending: true,
        tags: ["sachbuch", "notizen"], started: 250, finished: 236, minutes: 700 },
      { slug: "die-therapie", status: "READ", rating: 7, addedAgo: 95, visibility: "FRIENDS", lending: true,
        started: 92, finished: 89, minutes: 290 },
      { slug: "kafka-am-strand", status: "WANT_TO_READ", addedAgo: 20, visibility: "FRIENDS", tags: ["wunschliste"] },
      { slug: "project-hail-mary", status: "WANT_TO_READ", addedAgo: 8, visibility: "FRIENDS", tags: ["wunschliste", "scifi"] },
      { slug: "verwandlung", status: "READ", rating: 7, addedAgo: 500, visibility: "FRIENDS",
        started: 498, finished: 497, minutes: 95 },
      { slug: "die-unendliche-geschichte", status: "READ", rating: 9, addedAgo: 340, visibility: "FRIENDS", lending: true,
        tags: ["kindheit"], started: 330, finished: 322, minutes: 410 },
      { slug: "shining", status: "WANT_TO_READ", addedAgo: 5, visibility: "PRIVATE", tags: ["oktober"] },
    ],
    [max.id]: [
      { slug: "der-schwarm", status: "READ", rating: 8, addedAgo: 420, visibility: "FRIENDS", lending: true,
        started: 410, finished: 395, minutes: 900 },
      { slug: "es", status: "READ", rating: 9, addedAgo: 380, visibility: "FRIENDS", lending: true, favorite: true,
        started: 370, finished: 340, minutes: 1400 },
      { slug: "shining", status: "READ", rating: 8, addedAgo: 360, visibility: "FRIENDS", lending: true },
      { slug: "gone-girl", status: "READ", rating: 7, addedAgo: 250, visibility: "FRIENDS", lending: true },
      { slug: "harry-potter-1", status: "READ", rating: 9, addedAgo: 500, visibility: "FRIENDS", lending: false },
      { slug: "der-marsianer", status: "READING", page: 190, addedAgo: 18, visibility: "FRIENDS", started: 10 },
      { slug: "die-therapie", status: "READ", rating: 6, addedAgo: 200, visibility: "FRIENDS", lending: true },
      { slug: "tintenherz", status: "READ", rating: 8, addedAgo: 470, visibility: "FRIENDS", lending: true },
      { slug: "die-1-prozent-methode", status: "WANT_TO_READ", addedAgo: 12, visibility: "FRIENDS" },
      { slug: "der-grosse-gatsby", status: "READ", rating: 7, addedAgo: 300, visibility: "PRIVATE" },
    ],
    [lisa.id]: [
      { slug: "beach-read", status: "READ", rating: 9, addedAgo: 60, visibility: "FRIENDS", lending: true, favorite: true,
        started: 58, finished: 54, minutes: 380 },
      { slug: "normal-people", status: "READ", rating: 8, addedAgo: 120, visibility: "FRIENDS", lending: true },
      { slug: "stolz-und-vorurteil", status: "READ", rating: 10, addedAgo: 340, visibility: "FRIENDS", lending: false, favorite: true },
      { slug: "milch-und-honig", status: "READ", rating: 7, addedAgo: 90, visibility: "FRIENDS", lending: true },
      { slug: "der-marsianer", status: "READ", rating: 7, addedAgo: 180, visibility: "FRIENDS", lending: true },
      { slug: "harry-potter-1", status: "READING", page: 120, addedAgo: 9, visibility: "FRIENDS", started: 6 },
      { slug: "persepolis", status: "READ", rating: 9, addedAgo: 150, visibility: "FRIENDS", lending: true },
      { slug: "kafka-am-strand", status: "READING", page: 300, addedAgo: 25, visibility: "PRIVATE", started: 20 },
    ],
    [jonas.id]: [
      { slug: "die-1-prozent-methode", status: "READ", rating: 8, addedAgo: 70, visibility: "FRIENDS", lending: true },
      { slug: "sapiens", status: "READING", page: 300, addedAgo: 40, visibility: "FRIENDS", started: 30 },
      { slug: "es", status: "WANT_TO_READ", addedAgo: 15, visibility: "FRIENDS" },
      { slug: "harry-potter-1", status: "READ", rating: 8, addedAgo: 200, visibility: "FRIENDS", lending: true },
      { slug: "project-hail-mary", status: "READ", rating: 9, addedAgo: 100, visibility: "FRIENDS", lending: true },
    ],
  };

  const copyIds = new Map<string, string>(); // `${userId}:${slug}` → userBookId

  for (const [userId, copies] of Object.entries(library)) {
    const tagCache = new Map<string, string>();
    for (const copy of copies) {
      const bookId = bookIds.get(copy.slug)!;
      const pages = bookPages.get(copy.slug) ?? 300;
      const userBook = await db.userBook.create({
        data: {
          userId,
          bookId,
          status: copy.status,
          rating: copy.rating ?? null,
          notes: copy.notes ?? null,
          currentPage: copy.status === "READ" ? pages : copy.page ?? 0,
          favorite: copy.favorite ?? false,
          visibility: copy.visibility ?? "PRIVATE",
          lendingEnabled: copy.lending ?? false,
          startedAt: copy.started ? daysAgo(copy.started) : null,
          finishedAt: copy.finished ? daysAgo(copy.finished) : null,
          readingMinutes: copy.minutes ?? null,
          lastReadAt: copy.finished
            ? daysAgo(copy.finished)
            : copy.status === "READING"
              ? daysAgo(Math.floor(Math.random() * 3))
              : null,
          addedAt: daysAgo(copy.addedAgo),
        },
      });
      copyIds.set(`${userId}:${copy.slug}`, userBook.id);

      for (const tagName of copy.tags ?? []) {
        let tagId = tagCache.get(tagName);
        if (!tagId) {
          const tag = await db.tag.create({ data: { userId, name: tagName, slug: tagName.toLowerCase() } });
          tagId = tag.id;
          tagCache.set(tagName, tagId);
        }
        await db.bookTag.create({ data: { userBookId: userBook.id, tagId } });
      }

      // Leseverlauf für laufende und beendete Bücher
      if (copy.status === "READING" && copy.page) {
        const steps = 5;
        for (let i = 1; i <= steps; i++) {
          const page = Math.round((copy.page / steps) * i);
          await db.readingProgress.create({
            data: {
              userBookId: userBook.id,
              page,
              pagesRead: Math.round(copy.page / steps),
              createdAt: daysAgo((copy.started ?? 14) - i * 2),
            },
          });
        }
      }
      if (copy.status === "READ") {
        await db.readingProgress.create({
          data: {
            userBookId: userBook.id,
            page: pages,
            pagesRead: pages,
            note: "Fertig gelesen",
            createdAt: copy.finished ? daysAgo(copy.finished) : daysAgo(copy.addedAgo),
          },
        });
      }
    }
  }

  console.log("→ Fragebogen-Antworten …");
  const questions = await db.question.findMany({ include: { genre: true } });
  const qByKey = new Map(questions.map((q) => [q.key, q]));

  const answerSets: { key: string; answers: Record<string, unknown> }[] = [
    {
      key: `${basti.id}:gone-girl`,
      answers: {
        overall: 9, excitement: 5, emotional: 4, characters: 5, plot: 5, readability: 4,
        recommend: true, reread: false, pace: 85,
        "reading-place": ["Im Bett", "In der Bahn"],
        "mood-tags": ["atemlos", "düster"],
        "favorite-quote": "„Ich bin eine Frau, die aus Erwartungen zusammengesetzt ist.“",
        "feeling-after": "Leicht misstrauisch gegenüber allen Ehepaaren, die ich kenne.",
        "thriller-tension": 5, "thriller-twists": 5, "thriller-unpredictable": 4, "thriller-nerves": 5,
        "thriller-guessed": false, "mystery-clues": 4, "mystery-resolution": 5, "mystery-guessed": false,
      },
    },
    {
      key: `${basti.id}:harry-potter-1`,
      answers: {
        overall: 10, excitement: 4, emotional: 5, characters: 5, plot: 4, readability: 5,
        recommend: true, reread: true, pace: 60,
        "mood-tags": ["cozy", "warm", "hoffnungsvoll"],
        "fantasy-worldbuilding": 5, "fantasy-creativity": 5, "fantasy-elements": 5, "fantasy-magic-system": 4,
        "fantasy-map": false, "children-readaloud": 5,
        "feeling-after": "Wie immer: Ich wollte sofort weiterlesen.",
      },
    },
    {
      key: `${basti.id}:der-marsianer`,
      answers: {
        overall: 8, excitement: 4, characters: 4, plot: 4, readability: 5, recommend: true, reread: false,
        pace: 70, "mood-tags": ["witzig", "clever"],
        "scifi-ideas": 4, "scifi-plausibility": 5, "scifi-tech": 5,
      },
    },
    {
      key: `${lisa.id}:beach-read`,
      answers: {
        overall: 9, emotional: 5, characters: 5, readability: 5, recommend: true, reread: true,
        "romance-romantic": 5, "romance-chemistry": 5, "romance-sweetness": 4, "romance-emotion": 5,
        "romance-ending": 5, "romance-trope": ["Enemies to Lovers", "Slow Burn"],
        "mood-tags": ["sommer", "warm"],
      },
    },
  ];

  for (const set of answerSets) {
    const userBookId = copyIds.get(set.key);
    if (!userBookId) continue;
    for (const [qKey, value] of Object.entries(set.answers)) {
      const question = qByKey.get(qKey);
      if (!question) continue;
      await db.questionAnswer.create({
        data: { userBookId, questionId: question.id, value: JSON.stringify(value) },
      });
    }
  }

  console.log("→ Moodboards …");
  const moodboardFor = async (
    key: string,
    title: string,
    background: string,
    elements: {
      type: string; x: number; y: number; width: number; height: number; rotation?: number;
      text?: string; color?: string; fontFamily?: string; fontSize?: number; zIndex?: number;
    }[],
  ) => {
    const userBookId = copyIds.get(key);
    if (!userBookId) return;
    await db.moodboard.create({
      data: {
        userBookId,
        title,
        background,
        elements: {
          create: elements.map((el, i) => ({
            type: el.type,
            x: el.x, y: el.y, width: el.width, height: el.height,
            rotation: el.rotation ?? 0,
            zIndex: el.zIndex ?? i + 1,
            text: el.text ?? null,
            color: el.color ?? null,
            fontFamily: el.fontFamily ?? null,
            fontSize: el.fontSize ?? null,
          })),
        },
      },
    });
  };

  await moodboardFor(`${basti.id}:name-des-windes`, "Universität & Landstraßen", "paper", [
    { type: "TEXT", x: 60, y: 48, width: 420, height: 90, rotation: -2, text: "„Es war die Stille dreier Teile.“",
      color: "#2b2420", fontFamily: "display", fontSize: 30 },
    { type: "COLOR", x: 520, y: 40, width: 150, height: 150, rotation: 4, color: "#b9654c" },
    { type: "COLOR", x: 680, y: 70, width: 110, height: 110, rotation: -6, color: "#e0a458" },
    { type: "NOTE", x: 90, y: 200, width: 250, height: 210, rotation: 3,
      text: "Kvothes Lautenspiel – ich höre es beim Lesen wirklich.", color: "#fbecd2", fontFamily: "hand", fontSize: 20 },
    { type: "NOTE", x: 380, y: 250, width: 240, height: 200, rotation: -4,
      text: "Zu merken: Die Chandrian. Sieben Namen.", color: "#f2cec8", fontFamily: "hand", fontSize: 20 },
    { type: "TEXT", x: 660, y: 300, width: 300, height: 70, rotation: 2, text: "Herbst · Kerzen · Bier im Wirtshaus",
      color: "#5d5249", fontFamily: "sans", fontSize: 18 },
  ]);

  await moodboardFor(`${basti.id}:gone-girl`, "Kalte Ehe", "dark", [
    { type: "TEXT", x: 70, y: 60, width: 460, height: 80, rotation: -1, text: "Wem glaubst du?",
      color: "#f4ece2", fontFamily: "display", fontSize: 40 },
    { type: "COLOR", x: 560, y: 60, width: 180, height: 120, rotation: 3, color: "#6b8ca3" },
    { type: "NOTE", x: 120, y: 200, width: 260, height: 190, rotation: -3,
      text: "Das Tagebuch ist die eigentliche Waffe.", color: "#ece3ec", fontFamily: "hand", fontSize: 19 },
    { type: "COLOR", x: 430, y: 230, width: 130, height: 130, rotation: -8, color: "#2b2420" },
  ]);

  console.log("→ Ausleihen, Anfragen und Historie …");

  // 1) Max hat Basti „Der Schwarm“ geliehen – läuft gerade.
  const maxSchwarm = copyIds.get(`${max.id}:der-schwarm`)!;
  const schwarmRequest = await db.loanRequest.create({
    data: {
      userBookId: maxSchwarm, requesterId: basti.id, ownerId: max.id, status: "ACCEPTED",
      message: "Ich habe Urlaub – perfekt für 1000 Seiten!",
      createdAt: daysAgo(13), respondedAt: daysAgo(12),
    },
  });
  const schwarmLoan = await db.loan.create({
    data: {
      userBookId: maxSchwarm, requestId: schwarmRequest.id, lenderId: max.id, borrowerId: basti.id,
      status: "ACTIVE", startDate: daysAgo(12), dueDate: daysAhead(9), createdAt: daysAgo(12),
    },
  });
  await db.userBook.update({ where: { id: maxSchwarm }, data: { loanState: "LENT" } });
  await db.loanHistory.createMany({
    data: [
      { userBookId: maxSchwarm, loanId: schwarmLoan.id, lenderId: max.id, borrowerId: basti.id, event: "REQUESTED", createdAt: daysAgo(13) },
      { userBookId: maxSchwarm, loanId: schwarmLoan.id, lenderId: max.id, borrowerId: basti.id, event: "ACCEPTED",
        fromDate: daysAgo(12), toDate: daysAhead(9), createdAt: daysAgo(12) },
    ],
  });

  // 2) Basti hat Lisa „Harry Potter“ geliehen – Rückgabe steht bevor.
  const bastiHp = copyIds.get(`${basti.id}:harry-potter-1`)!;
  const hpRequest = await db.loanRequest.create({
    data: {
      userBookId: bastiHp, requesterId: lisa.id, ownerId: basti.id, status: "ACCEPTED",
      message: "Ich habe es tatsächlich noch nie gelesen 🙈", createdAt: daysAgo(10), respondedAt: daysAgo(9),
    },
  });
  const hpLoan = await db.loan.create({
    data: {
      userBookId: bastiHp, requestId: hpRequest.id, lenderId: basti.id, borrowerId: lisa.id,
      status: "ACTIVE", startDate: daysAgo(9), dueDate: daysAhead(3), createdAt: daysAgo(9),
    },
  });
  await db.userBook.update({ where: { id: bastiHp }, data: { loanState: "LENT" } });
  await db.loanHistory.createMany({
    data: [
      { userBookId: bastiHp, loanId: hpLoan.id, lenderId: basti.id, borrowerId: lisa.id, event: "REQUESTED", createdAt: daysAgo(10) },
      { userBookId: bastiHp, loanId: hpLoan.id, lenderId: basti.id, borrowerId: lisa.id, event: "ACCEPTED",
        fromDate: daysAgo(9), toDate: daysAhead(3), createdAt: daysAgo(9) },
    ],
  });

  // 3) Abgeschlossene Ausleihe: Max → Lisa, „Es“.
  const maxEs = copyIds.get(`${max.id}:es`)!;
  const esLoan = await db.loan.create({
    data: {
      userBookId: maxEs, lenderId: max.id, borrowerId: lisa.id, status: "RETURNED",
      startDate: daysAgo(70), dueDate: daysAgo(40), returnedAt: daysAgo(38), createdAt: daysAgo(70),
      note: "Pünktlich zurück, mit Lesezeichen als Dank.",
    },
  });
  await db.loanHistory.createMany({
    data: [
      { userBookId: maxEs, loanId: esLoan.id, lenderId: max.id, borrowerId: lisa.id, event: "REQUESTED", createdAt: daysAgo(72) },
      { userBookId: maxEs, loanId: esLoan.id, lenderId: max.id, borrowerId: lisa.id, event: "ACCEPTED",
        fromDate: daysAgo(70), toDate: daysAgo(40), createdAt: daysAgo(70) },
      { userBookId: maxEs, loanId: esLoan.id, lenderId: max.id, borrowerId: lisa.id, event: "RETURNED",
        fromDate: daysAgo(70), toDate: daysAgo(38), createdAt: daysAgo(38) },
    ],
  });

  // 4) Offene Anfrage: Lisa möchte Bastis „Der Name des Windes“.
  const bastiWind = copyIds.get(`${basti.id}:name-des-windes`)!;
  await db.loanRequest.create({
    data: {
      userBookId: bastiWind, requesterId: lisa.id, ownerId: basti.id, status: "PENDING",
      message: "Max hat es mir empfohlen – darf ich?", createdAt: daysAgo(1),
    },
  });
  await db.userBook.update({ where: { id: bastiWind }, data: { loanState: "REQUESTED" } });
  await db.loanHistory.create({
    data: { userBookId: bastiWind, lenderId: basti.id, borrowerId: lisa.id, event: "REQUESTED", createdAt: daysAgo(1) },
  });

  console.log("→ Benachrichtigungen …");
  await db.notification.createMany({
    data: [
      { userId: basti.id, category: "LOAN", type: "LOAN_REQUEST", title: "Neue Ausleihanfrage",
        body: "Lisa Brandt möchte dein Buch „Der Name des Windes“ ausleihen.",
        href: "/loans", actorId: lisa.id, entityId: bastiWind, read: false, createdAt: daysAgo(1) },
      { userId: basti.id, category: "FRIEND", type: "FRIEND_REQUEST", title: "Neue Freundschaftsanfrage",
        body: "Jonas Weber möchte mit dir Bücher teilen.", href: "/friends", actorId: jonas.id, read: false, createdAt: daysAgo(1) },
      { userId: basti.id, category: "LOAN", type: "RETURN_DUE_SOON", title: "Rückgabe steht bevor",
        body: "„Harry Potter und der Stein der Weisen“ ist in 3 Tagen bei Lisa Brandt fällig.",
        href: "/loans", entityId: hpLoan.id, read: false, createdAt: daysAgo(0.2) },
      { userId: basti.id, category: "LOAN", type: "LOAN_ACCEPTED", title: "Ausleihe bestätigt",
        body: "Max Köhler leiht dir „Der Schwarm“ bis zum Monatsende.", href: "/loans",
        actorId: max.id, entityId: schwarmLoan.id, read: true, createdAt: daysAgo(12) },
      { userId: basti.id, category: "SYSTEM", type: "SYSTEM", title: "Willkommen im Bücherregal",
        body: "Push-Benachrichtigungen kannst du in den Einstellungen aktivieren.", href: "/profile", read: true, createdAt: daysAgo(120) },
      { userId: max.id, category: "LOAN", type: "RETURN_CONFIRMED", title: "Rückgabe bestätigt",
        body: "Lisa Brandt hat „Es“ zurückgegeben.", href: "/loans", actorId: lisa.id, read: true, createdAt: daysAgo(38) },
      { userId: lisa.id, category: "LOAN", type: "LOAN_ACCEPTED", title: "Ausleihe bestätigt",
        body: "Basti leiht dir „Harry Potter und der Stein der Weisen“.", href: "/loans", actorId: basti.id, read: false, createdAt: daysAgo(9) },
    ],
  });

  const counts = {
    Benutzer: await db.user.count(),
    Bücher: await db.book.count(),
    Exemplare: await db.userBook.count(),
    Fragen: await db.question.count(),
    Ausleihen: await db.loan.count(),
    Benachrichtigungen: await db.notification.count(),
  };
  console.log("\n✔ Seed abgeschlossen:", counts);
  console.log(`\n  Anmeldung: basti@buchregal.app / ${DEMO_PASSWORD}`);
  console.log(`  Weitere Konten: max@, lisa@, jonas@buchregal.app (gleiches Passwort)\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
