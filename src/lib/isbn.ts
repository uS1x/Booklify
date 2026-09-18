/**
 * ISBN-Hilfsfunktionen – laufen im Browser (Scanner) und auf dem Server
 * (Buchsuche). Buch-Barcodes sind EAN-13-Codes mit dem Präfix 978 oder 979
 * („Bookland“); deren Ziffern sind die ISBN-13.
 */

/** Entfernt Bindestriche, Leerzeichen & Co.; ein abschließendes X bleibt erhalten. */
export function cleanIsbn(raw: string) {
  return raw.toUpperCase().replace(/[^0-9X]/g, "");
}

export function isValidIsbn13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(value[12]);
}

export function isValidIsbn10(value: string) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const sum = [...value].reduce(
    (acc, char, index) => acc + (char === "X" ? 10 : Number(char)) * (10 - index),
    0,
  );
  return sum % 11 === 0;
}

export function isbn10To13(isbn10: string) {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce((acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** Normalisiert eine eingegebene ISBN-10 oder -13 zu einer gültigen ISBN-13 – sonst null. */
export function toIsbn13(raw: string): string | null {
  const value = cleanIsbn(raw);
  if (isValidIsbn13(value) && /^97[89]/.test(value)) return value;
  if (isValidIsbn10(value)) return isbn10To13(value);
  return null;
}

export type BarcodeCheck =
  | { ok: true; isbn: string }
  | { ok: false; reason: "not-isbn" | "invalid" };

/**
 * Prüft den Inhalt eines gescannten Barcodes. Nur EAN-13 mit Bookland-Präfix
 * und korrekter Prüfziffer gelten als ISBN; Preis- oder Handelscodes nicht.
 */
export function isbnFromBarcode(text: string): BarcodeCheck {
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 13) return { ok: false, reason: "not-isbn" };
  if (!isValidIsbn13(digits)) return { ok: false, reason: "invalid" };
  if (!/^97[89]/.test(digits)) return { ok: false, reason: "not-isbn" };
  return { ok: true, isbn: digits };
}

/** 9783551551672 → 978-3-551-55167-2 wäre verlagsabhängig; für die Anzeige genügt 978-3551551672. */
export function formatIsbn(isbn: string) {
  return isbn.length === 13 ? `${isbn.slice(0, 3)}-${isbn.slice(3)}` : isbn;
}
