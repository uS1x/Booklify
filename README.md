# 📚 Bücherregal

Ein digitales Bücherregal: persönliche Bibliothek, Reading Tracker, Buch-Tagebuch,
Moodboards, Statistiken – und eine private soziale Bibliothek, in der Freunde
Bücher sehen und ausleihen können.

Im Mittelpunkt steht ein visuelles Regal: Bücher stehen als Cover in Regalböden,
unterschiedlich groß, leicht geneigt, und schlagen beim Anklicken auf.

---

## Schnellstart

Voraussetzung: Node.js ≥ 20.9 (empfohlen 24, siehe `.nvmrc`).

```bash
git clone <repo-url> buecherregal
cd buecherregal
npm install
npm run setup     # .env anlegen, Datenbank erstellen, Stammdaten einspielen
npm run dev
```

Danach `http://localhost:3100` öffnen. Der Port ist in `package.json` festgelegt
(`dev` und `start`); ein Reverse Proxy oder Tunnel muss auf denselben Port zeigen.

`npm run setup` legt beim ersten Aufruf eine `.env` aus `.env.example` an – mit
zufälligem `AUTH_SECRET` und frischem VAPID-Schlüsselpaar für Web Push. Eine
vorhandene `.env` wird nie überschrieben.

Beim ersten Aufruf ein Konto unter `/register` anlegen – die Datenbank startet leer.
Der Seed enthält ausschließlich Stammdaten (Genres und den Fragenkatalog) und kann
jederzeit erneut ausgeführt werden, ohne Benutzerdaten zu verändern.

> Wird `npm install` mit npm 11 ausgeführt und brechen Prisma oder esbuild ab, müssen
> deren Install-Skripte einmal freigegeben werden:
> `npm install-scripts approve @prisma/client prisma @prisma/engines esbuild`

---

## Technischer Stack

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Server Components + Server Actions: Berechtigungen bleiben serverseitig |
| Sprache | **TypeScript** (strict) | |
| Styling | **Tailwind CSS v4** | Designsystem als CSS-Tokens in `src/app/globals.css`, Dark Mode über `.dark` |
| Datenbank | **SQLite via Prisma** | relationales Modell ohne Setup-Aufwand; Wechsel auf Postgres = ein Datasource-Eintrag |
| Auth | eigene Session-Auth (`scrypt` + signiertes HttpOnly-Cookie) | keine zusätzliche Abhängigkeit, Sessions in der DB widerrufbar |
| Animationen | **Framer Motion** | Regal, Buch-Aufschlagen, Dialoge |
| Icons | **lucide-react** | |
| Validierung | **zod** | jede Server Action validiert ihre Eingaben |
| Push | **web-push** (VAPID) + eigener Service Worker | |

Bewusst *nicht* verwendet: UI-Kit, State-Management-Library, Chart-Library
(Diagramme sind schlankes Inline-SVG), Auth-Framework.

---

## Funktionsumfang

### Regal & Bibliothek
- **Regalansicht** mit Regalböden, variablen Buchhöhen/-breiten (aus der Seitenzahl
  abgeleitet), leichter Neigung, Schatten, Hover-Lift, Lesezeichen für laufende Bücher
- **Grid** und **Liste** als Alternativen; die Auswahl wird pro Gerät gespeichert
  (mobil startet das Grid)
- Klick auf ein Buch: **Quick-Look**, bei dem das Cover aufklappt
- Suche über Titel, Autor, Verlag, Genre, Tags und Notizen; Filter nach Genre, Tag,
  Jahr, Bewertung, Lesestatus; Sortierung nach Datum, Titel, Autor, Bewertung, letztem Lesen
- Kompaktes Dashboard: Anzahl Bücher, aktuell gelesen, gelesene Seiten,
  Ø Bewertung, Lieblingsgenre, zuletzt gelesen

### Bücher
- Werk (`Book`) und Exemplar (`UserBook`) sind getrennt: mehrere Benutzer können
  dasselbe Buch besitzen – Grundlage für „3 deiner Freunde besitzen dieses Buch“
- Titel, Untertitel, Autor, Cover, Beschreibung, ISBN, Jahr, Verlag, Seitenzahl,
  Sprache, Genres, Tags, Lesestatus, Bewertung (1–10), Notizen, Hinzugefügt-Datum,
  Lesefortschritt, Start-/Enddatum, optionale Lesedauer
- **Mehrstufiger Wizard**: Suche (Titel/Autor/ISBN) → Angaben prüfen → eigenes
  Exemplar einrichten. Alle automatisch übernommenen Felder sind editierbar; ohne
  API funktioniert die vollständig manuelle Anlage
- **ISBN-Barcode scannen**: Kamera auf die Buchrückseite richten – die ISBN wird
  erkannt, geprüft (Bookland-Präfix 978/979 und Prüfziffer) und sofort gesucht. Bei
  eindeutigem Treffer werden die Angaben der gescannten *Ausgabe* übernommen
  (Open-Library-Editionsdaten: Titel in der Sprache der Ausgabe, Verlag, Seitenzahl,
  Cover). Nicht gefundene ISBNs lassen sich direkt manuell mit vorausgefüllter ISBN anlegen.
  Erkennung über das native `BarcodeDetector`-API (Android/Chrome) oder ZXing als
  Fallback, das erst beim Öffnen des Scanners geladen wird. Die Live-Kamera braucht
  HTTPS oder `localhost`; ohne Kamera funktioniert der Scan über ein Foto.
- **Cover selbst aufnehmen**: Foto vom Buch machen – die App erkennt die Buchkanten,
  entzerrt die Perspektive und schneidet gerade zu, die vier Ecken lassen sich von Hand
  nachziehen. Erkannt wird über den Farbabstand zum Untergrund (nicht über Kantenstärke),
  weil Titelzeilen auf dem Cover sonst stärkere Kanten liefern als der Übergang zum Tisch.
  Ohne erkennbares Buch bleibt das Bild unbeschnitten. Alles läuft lokal im Browser,
  ohne Bildbibliothek. Der native Dokumentenscanner von iOS/Android ist für Webseiten
  nicht zugänglich; auf dem iPhone lässt sich aber die Dateien-App („Dokumente scannen“)
  nutzen und der Scan anschließend auswählen.
  Eigene Fotos gehören zum **Exemplar** (`UserBook.coverOverride`), nicht zum gemeinsamen
  Werk, und werden nur an Berechtigte ausgeliefert.
- Lesefortschritt: `234 / 412 Seiten` → `57 % gelesen`, mit Verlaufsprotokoll
  (`ReadingProgress`); Erreichen der letzten Seite schließt das Buch automatisch ab

### Persönliches
- **Fragebogen, vollständig datengetrieben**: Fragen liegen in der Tabelle `Question`
  mit `scope = GENERAL | GENRE`. Für ein Buch werden allgemeine Fragen plus die
  Fragen aller Genres des Buches geladen – kein Code pro Genre.
  Fragetypen: `RATING_5`, `RATING_10`, `SLIDER`, `YES_NO`, `CHOICE`, `TEXT`, `TAGS`.
  Neue Typen werden in der Registry in `src/components/questions/question-input.tsx`
  ergänzt; Datenmodell und Auswertung bleiben unverändert.
  Jede Frage kann übersprungen werden (`skipped`).
- **Moodboard** als freie Pinnwand: Bilder (Suche oder Upload), Texte, Notizzettel,
  Farbflächen und Zeichnungen – verschieben, skalieren, drehen, stapeln, duplizieren,
  löschen; Tastaturbedienung (Pfeiltasten, Entf); Hintergründe; Touch-fähig
- **Zeichnen**: Stift, Radierer, vier Strichstärken, Farben, Undo, Redo, Löschen,
  Speichern – über Pointer-Events auch mit Finger und Stift; die Zeichnung landet als
  Element auf dem Moodboard und in der Galerie des Buches

### Social & Ausleihe
- Freunde suchen, Anfragen senden, annehmen, ablehnen, zurückziehen, entfernen
- Regal teilen: Grundsichtbarkeit (privat / mit Freunden) **und** Freigabe pro Freund
  mit `Nur ansehen` oder `Ausleihe anfragen`
- Sichtbarkeit pro Exemplar (privat / geteilt) und Schalter „Ausleihen erlauben“
- Vollständiges Ausleihsystem: Anfrage mit Nachricht → Annahme mit Ausleih- und
  Rückgabedatum → laufende Ausleihe → Rückgabe anfragen → Rückgabe bestätigen.
  Status: `Verfügbar`, `Anfrage ausstehend`, `Ausgeliehen`, `Rückgabe angefragt`,
  `Zurückgegeben`, `Abgelehnt`, `Storniert`
- Unveränderliche **Ausleihhistorie** (`LoanHistory`), standardmäßig nur für den Besitzer
- Im Regal eines Freundes: `📚 Im Besitz von Max`, `Ausleihe anfragen` bzw.
  `Du besitzt dieses Buch bereits.`

### Benachrichtigungen
- Glocke mit Badge, eigenes Center mit Kategorien (Alle / Freunde / Ausleihen / System),
  einzeln oder gesammelt als gelesen markieren, öffnen, entfernen
- Anlässe: Freundschaftsanfrage, Freundschaft bestätigt, Regal freigegeben,
  Ausleihanfrage, Annahme, Ablehnung, Storno, Rückgabe angefragt, Rückgabe bestätigt,
  bevorstehende/überfällige Rückgabe
- **Web Push**: Service Worker, Subscription-Speicherung, Kategorie-Präferenzen,
  Testbenachrichtigung; abgelaufene Subscriptions werden automatisch entfernt

### Statistiken
Gelesene Bücher und Seiten, Bücher pro Monat und Jahr, Seiten pro Monat,
Ø Bewertung, Ø Lesedauer, meistgelesene Genres, aktueller Lesefortschritt,
verliehene und ausgeliehene Bücher, Regal-Zusammensetzung – alles dynamisch berechnet.
Die Diagramme sind Inline-SVG mit einer geprüften Ein-Farb-Skala, Direktbeschriftung
der Spitzenwerte, Tooltips und einer Tabellenansicht.

### PWA
Manifest mit Shortcuts, installierbar, eigener Service Worker
(`public/sw.js`): Seiten „network-first“ mit Offline-Fallback, statische Assets
„cache-first“, Push und Notification-Klick. Offline-Seite unter `/offline`.

---

## Externe APIs (optional, ohne Keys funktionsfähig)

| Zweck | Variable | Standard |
|---|---|---|
| Buch-Metadaten | `BOOK_PROVIDER=openlibrary \| googlebooks \| none` | `openlibrary` (**kein Key nötig**) |
| Google Books | `GOOGLE_BOOKS_API_KEY` | leer (Provider funktioniert auch ohne) |
| Bildsuche | `IMAGE_PROVIDER=unsplash \| pexels \| none` | `none` |
| Unsplash / Pexels | `UNSPLASH_ACCESS_KEY` / `PEXELS_API_KEY` | leer |
| Web Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | via `npm run push:keys` erzeugt |
| Rückgabe-Erinnerungen per Cron | `MAINTENANCE_KEY` | leer = Route deaktiviert |

Die Provider liegen hinter einer Abstraktion (`src/lib/providers/`). Fehlt ein Key,
bleibt die jeweilige Funktion sauber deaktiviert: Bücher lassen sich manuell anlegen,
Moodboard-Bilder hochladen. **Keys stehen ausschließlich in `.env`.**

Erinnerungen für alle Benutzer per Cron:

```bash
curl -X POST -H "x-maintenance-key: $MAINTENANCE_KEY" http://localhost:3100/api/maintenance/reminders
```

---

## Datenschutz & Sicherheit

- Jede Berechtigungsprüfung passiert **serverseitig** (`src/lib/permissions.ts`).
  Das Frontend zeigt nur, was der Server ohnehin freigibt.
- Zugriffsstufen auf ein fremdes Regal: `OWNER` → `REQUEST_LOAN` → `VIEW` → `NONE`.
  Ohne bestätigte Freundschaft immer `NONE` – auch bei manipulierten URLs oder
  direkten API-Aufrufen (fremde private Bücher liefern `404`, nicht `403`, damit keine
  Existenz verraten wird).
- Private Exemplare bleiben privat, selbst wenn das Regal insgesamt geteilt ist.
- Notizen, Bewertungsdetails, Fragebogen-Antworten, Moodboards und Zeichnungen sind
  grundsätzlich nur für den Besitzer sichtbar.
- Uploads liegen außerhalb von `public/` (`data/uploads/`) und werden über
  `/api/media/[id]` mit Zugriffsprüfung ausgeliefert.
- Passwörter: `scrypt` mit Zufallssalt; Sessions als signierte HttpOnly-Cookies mit
  DB-Eintrag (serverseitig widerrufbar); Login-Fehler sind nicht unterscheidbar.

---

## Datenmodell

`User`, `Session`, `Book`, `UserBook`, `Genre`, `BookGenre`, `Tag`, `BookTag`,
`ReadingProgress`, `Question`, `QuestionAnswer`, `Moodboard`, `MoodboardElement`,
`Drawing`, `MediaAsset`, `Friendship`, `SharedShelf`, `SharedShelfMember`,
`LoanRequest`, `Loan`, `LoanHistory`, `Notification`, `PushSubscription`,
`NotificationPreference` – siehe `prisma/schema.prisma`.

```
Book  „Harry Potter 1“
 ├── UserBook  Basti besitzt es   → Status, Notizen, Moodboard, Sichtbarkeit, Ausleihe
 └── UserBook  Max besitzt es     → eigene Daten, eigene Freigaben
```

SQLite kennt keine Enums; Statuswerte sind Strings und werden in
`src/lib/constants.ts` als TypeScript-Unions samt Labels definiert und in den
Server Actions mit zod validiert.

---

## Projektstruktur

```
prisma/           schema.prisma, seed.ts, seed-data.ts (Genres und Fragenkatalog)
scripts/          VAPID-Schlüssel, PWA-Icons erzeugen
src/app/
  (app)/          angemeldeter Bereich: Regal, Bücher, Detailseite, Moodboard,
                  Fragebogen, Freunde, Ausleihen, Statistiken, Benachrichtigungen, Profil
  (auth)/         Login, Registrierung
  api/            Buchsuche, Bildsuche, Uploads, Medien, Cron-Erinnerungen
src/components/   ui/ (Designsystem), books/, moodboard/, questions/, loans/,
                  friends/, notifications/, charts/, layout/, dashboard/
src/lib/          auth, permissions, db, notifications, push, uploads, providers, format
src/server/
  actions/        Server Actions (alle mit Authentifizierung + zod-Validierung)
  queries/        Leseabfragen samt serialisierbaren DTOs
```

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktionsbuild und -start |
| `npm run setup` | `.env` anlegen (falls fehlend), Client generieren, Datenbank anlegen, Stammdaten |
| `npm run db:push` / `db:seed` / `db:studio` | Prisma-Werkzeuge |
| `npm run push:keys` | VAPID-Schlüsselpaar erzeugen und in `.env` schreiben |
| `npm run typecheck` / `npm run lint` | TypeScript und ESLint |

## Erweitern

- **Neuer Fragetyp**: Renderer in `question-input.tsx` ergänzen, Typ in
  `QUESTION_TYPES` aufnehmen, Fragen mit dem Typ anlegen – fertig.
- **Neues Genre samt Fragen**: Eintrag in `prisma/seed-data.ts` (oder direkt in der DB).
- **Anderer Buch-/Bildanbieter**: Funktion in `src/lib/providers/` ergänzen und über
  `BOOK_PROVIDER`/`IMAGE_PROVIDER` auswählen.
- **Postgres statt SQLite**: `datasource db` in `prisma/schema.prisma` umstellen,
  `DATABASE_URL` setzen, `prisma migrate dev`. Enum-Strings können dann echte Enums werden.
- **Moodboard-Elementtyp**: Typ in `MOODBOARD_ELEMENT_TYPES` ergänzen und in
  `element-view.tsx` rendern.
