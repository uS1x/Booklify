/** Zentrale Statuswerte und Labels. SQLite kennt keine Enums – deshalb hier. */

export const READING_STATUSES = ["WANT_TO_READ", "READING", "READ", "ABANDONED"] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export const READING_STATUS_META: Record<
  ReadingStatus,
  { label: string; short: string; emoji: string; tone: string; dot: string }
> = {
  WANT_TO_READ: {
    label: "Möchte ich lesen",
    short: "Wunschliste",
    emoji: "🌱",
    tone: "bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200",
    dot: "bg-sage-400",
  },
  READING: {
    label: "Lese ich gerade",
    short: "Aktuell",
    emoji: "📖",
    tone: "bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200",
    dot: "bg-honey-400",
  },
  READ: {
    label: "Gelesen",
    short: "Gelesen",
    emoji: "✨",
    tone: "bg-clay-100 text-clay-600 dark:bg-clay-400/20 dark:text-clay-200",
    dot: "bg-clay-400",
  },
  ABANDONED: {
    label: "Abgebrochen",
    short: "Abgebrochen",
    emoji: "🥀",
    tone: "bg-paper-deep text-ink-soft dark:bg-white/10 dark:text-ink-soft",
    dot: "bg-ink-faint",
  },
};

export const VISIBILITIES = ["PRIVATE", "FRIENDS"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_META: Record<Visibility, { label: string; hint: string }> = {
  PRIVATE: { label: "Privat", hint: "Nur du siehst dieses Buch." },
  FRIENDS: { label: "Mit Freunden geteilt", hint: "Freigegebene Freunde sehen dieses Buch." },
};

export const SHELF_PERMISSIONS = ["VIEW", "REQUEST_LOAN"] as const;
export type ShelfPermission = (typeof SHELF_PERMISSIONS)[number];

export const SHELF_PERMISSION_META: Record<ShelfPermission, { label: string; hint: string }> = {
  VIEW: { label: "Nur ansehen", hint: "Kann deine geteilten Bücher sehen." },
  REQUEST_LOAN: { label: "Ausleihe anfragen", hint: "Kann zusätzlich Ausleihen anfragen." },
};

export const LOAN_STATES = ["AVAILABLE", "REQUESTED", "LENT", "RETURN_REQUESTED"] as const;
export type LoanState = (typeof LOAN_STATES)[number];

export const LOAN_STATE_META: Record<LoanState, { label: string; tone: string }> = {
  AVAILABLE: { label: "Verfügbar", tone: "bg-sage-100 text-sage-500 dark:bg-sage-500/20 dark:text-sage-200" },
  REQUESTED: { label: "Anfrage ausstehend", tone: "bg-honey-100 text-honey-500 dark:bg-honey-400/20 dark:text-honey-200" },
  LENT: { label: "Ausgeliehen", tone: "bg-clay-100 text-clay-600 dark:bg-clay-400/20 dark:text-clay-200" },
  RETURN_REQUESTED: { label: "Rückgabe angefragt", tone: "bg-plum-100 text-plum-500 dark:bg-plum-400/20 dark:text-plum-200" },
};

export const LOAN_REQUEST_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"] as const;
export type LoanRequestStatus = (typeof LOAN_REQUEST_STATUSES)[number];

export const LOAN_REQUEST_STATUS_LABEL: Record<LoanRequestStatus, string> = {
  PENDING: "Anfrage ausstehend",
  ACCEPTED: "Angenommen",
  DECLINED: "Abgelehnt",
  CANCELLED: "Storniert",
};

export const LOAN_STATUSES = ["ACTIVE", "RETURN_REQUESTED", "RETURNED"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  ACTIVE: "Ausgeliehen",
  RETURN_REQUESTED: "Rückgabe angefragt",
  RETURNED: "Zurückgegeben",
};

export const LOAN_EVENT_LABEL: Record<string, string> = {
  REQUESTED: "Ausleihe angefragt",
  ACCEPTED: "Ausleihe bestätigt",
  DECLINED: "Anfrage abgelehnt",
  CANCELLED: "Anfrage storniert",
  RETURN_REQUESTED: "Rückgabe angefragt",
  RETURNED: "Zurückgegeben",
};

export const FRIENDSHIP_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export const QUESTION_TYPES = [
  "RATING_5",
  "RATING_10",
  "SLIDER",
  "YES_NO",
  "CHOICE",
  "TEXT",
  "TAGS",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const NOTIFICATION_CATEGORIES = ["FRIEND", "LOAN", "SYSTEM"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory | "ALL", string> = {
  ALL: "Alle",
  FRIEND: "Freunde",
  LOAN: "Ausleihen",
  SYSTEM: "System",
};

export const MOODBOARD_ELEMENT_TYPES = ["IMAGE", "TEXT", "NOTE", "COLOR", "DRAWING"] as const;
export type MoodboardElementType = (typeof MOODBOARD_ELEMENT_TYPES)[number];

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "Englisch" },
  { code: "fr", label: "Französisch" },
  { code: "es", label: "Spanisch" },
  { code: "it", label: "Italienisch" },
  { code: "nl", label: "Niederländisch" },
  { code: "sv", label: "Schwedisch" },
  { code: "ja", label: "Japanisch" },
  { code: "other", label: "Andere" },
];

export const LANGUAGE_LABEL = (code?: string | null) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code?.toUpperCase() ?? "—";

/** Sortier- und Ansichtsoptionen der Bibliothek. */
export const SORT_OPTIONS = [
  { value: "recent", label: "Zuletzt hinzugefügt" },
  { value: "title", label: "Titel" },
  { value: "author", label: "Autor" },
  { value: "rating", label: "Bewertung" },
  { value: "lastRead", label: "Zuletzt gelesen" },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const VIEW_MODES = ["shelf", "grid", "list"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/** Fallback-Farbpaletten für Cover ohne Bild. */
export const COVER_PALETTES = [
  ["#b9654c", "#e0a458"],
  ["#7e9a7b", "#c9d8c5"],
  ["#8c6b8e", "#e4a9a0"],
  ["#6b8ca3", "#bed1de"],
  ["#c9873c", "#f5d9a8"],
  ["#5d5249", "#b98a63"],
  ["#9c503b", "#ebc0b1"],
  ["#5f7c5d", "#ecc078"],
];

export const ACCENT_COLORS = [
  { key: "clay", label: "Terrakotta", hex: "#b9654c" },
  { key: "honey", label: "Honig", hex: "#e0a458" },
  { key: "sage", label: "Salbei", hex: "#7e9a7b" },
  { key: "plum", label: "Pflaume", hex: "#8c6b8e" },
  { key: "ocean", label: "Ozean", hex: "#6b8ca3" },
];

export const ACCENT_HEX = (key?: string | null) =>
  ACCENT_COLORS.find((c) => c.key === key)?.hex ?? "#b9654c";
