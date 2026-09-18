const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateLongFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const numberFmt = new Intl.NumberFormat("de-DE");

export const formatDate = (d?: Date | string | null) => (d ? dateFmt.format(new Date(d)) : "—");
export const formatDateLong = (d?: Date | string | null) => (d ? dateLongFmt.format(new Date(d)) : "—");
export const formatMonth = (d: Date | string) => monthFmt.format(new Date(d));
export const formatNumber = (n?: number | null) => numberFmt.format(n ?? 0);

export function formatRange(from?: Date | string | null, to?: Date | string | null) {
  if (!from) return "—";
  return `${formatDate(from)} – ${to ? formatDate(to) : "offen"}`;
}

/** „vor 3 Tagen“, „gerade eben“ … */
export function formatRelative(date: Date | string) {
  const then = new Date(date).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.round(days / 30);
  if (months < 12) return `vor ${months} Mon.`;
  return `vor ${Math.round(months / 12)} J.`;
}

/** Tage bis zu einem Datum (negativ = überfällig). */
export function daysUntil(date: Date | string) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function pluralize(n: number, one: string, many: string) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function progressPercent(currentPage: number, pageCount?: number | null) {
  if (!pageCount || pageCount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((currentPage / pageCount) * 100)));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Deterministische Cover-Farbe aus einem String (Titel/ID). */
export function hashToIndex(value: string, buckets: number) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) % 100000;
  return h % buckets;
}

export function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
