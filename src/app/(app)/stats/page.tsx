import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarRange, Clock, FileText, HandHeart, Star, TrendingUp } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getReadingStats } from "@/server/queries/stats";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ColumnChart } from "@/components/charts/column-chart";
import { BarList } from "@/components/charts/bar-list";
import { ProgressBar } from "@/components/ui/progress";
import { BookCover } from "@/components/ui/book-cover";
import { EmptyState } from "@/components/ui/empty-state";
import { READING_STATUS_META } from "@/lib/constants";
import { formatNumber, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Statistiken" };

export default async function StatsPage() {
  const user = await requireUser();
  const stats = await getReadingStats(user.id);

  const monthsWithData = stats.months.some((month) => month.books > 0 || month.pages > 0);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-ink">Statistiken</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Alles direkt aus deinem Regal berechnet – Seiten, Monate, Genres, Ausleihen.
        </p>
      </header>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={<BookOpen size={14} />} label="Gelesene Bücher" value={formatNumber(stats.booksRead)} hint={`${stats.booksThisYear} in diesem Jahr`} />
        <Tile icon={<FileText size={14} />} label="Gelesene Seiten" value={formatNumber(stats.pagesRead)} hint={stats.pagesThisMonth ? `${formatNumber(stats.pagesThisMonth)} diesen Monat` : undefined} />
        <Tile icon={<Star size={14} />} label="Ø Bewertung" value={stats.averageRating ? `${stats.averageRating.toString().replace(".", ",")}` : "—"} hint={stats.averageRating ? "von 10" : "noch keine"} />
        <Tile icon={<Clock size={14} />} label="Ø Lesedauer" value={stats.averageReadingDays ? `${stats.averageReadingDays} Tage` : "—"} hint={stats.averageReadingMinutes ? `${Math.round(stats.averageReadingMinutes / 60)} h pro Buch` : undefined} />
        <Tile icon={<HandHeart size={14} />} label="Verliehen" value={formatNumber(stats.lentOut)} hint={`${stats.loansTotal} Ausleihen insgesamt`} />
        <Tile icon={<HandHeart size={14} />} label="Ausgeliehen" value={formatNumber(stats.borrowed)} hint="von Freunden" />
      </div>

      {/* Bücher & Seiten pro Monat */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Bücher pro Monat"
            subtitle="Beendete Bücher der letzten zwölf Monate"
          />
          <CardBody>
            <ColumnChart
              data={stats.months.map((month) => ({
                label: month.label,
                value: month.books,
                sublabel: month.key,
              }))}
              unit=" Bücher"
              emptyLabel="Sobald du ein Buch beendest, erscheint hier der erste Balken."
            />
            {monthsWithData ? (
              <details className="mt-3 text-xs text-ink-faint">
                <summary className="cursor-pointer select-none hover:text-ink">Werte als Tabelle</summary>
                <table className="mt-2 w-full text-left">
                  <thead>
                    <tr className="text-ink-faint">
                      <th className="py-1 font-normal">Monat</th>
                      <th className="py-1 text-right font-normal">Bücher</th>
                      <th className="py-1 text-right font-normal">Seiten</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-soft">
                    {stats.months.map((month) => (
                      <tr key={month.key} className="border-t border-ink/6 dark:border-white/6">
                        <td className="py-1">{month.key}</td>
                        <td className="py-1 text-right tabular-nums">{month.books}</td>
                        <td className="py-1 text-right tabular-nums">{formatNumber(month.pages)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Seiten pro Monat" subtitle="Summe der Seiten beendeter Bücher" />
          <CardBody>
            <ColumnChart
              data={stats.months.map((month) => ({
                label: month.label,
                value: month.pages,
                sublabel: month.key,
              }))}
              unit=" Seiten"
              emptyLabel="Noch keine beendeten Bücher in diesem Zeitraum."
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Jahre */}
        <Card>
          <CardHeader
            title="Bücher pro Jahr"
            subtitle={<span className="inline-flex items-center gap-1.5"><CalendarRange size={13} />Die letzten Lesejahre</span>}
          />
          <CardBody>
            <BarList
              data={stats.years.map((year) => ({
                label: String(year.year),
                value: year.books,
                hint: `${formatNumber(year.pages)} S.`,
              }))}
              unit=" Bücher"
              emptyLabel="Noch kein abgeschlossenes Lesejahr."
            />
          </CardBody>
        </Card>

        {/* Genres */}
        <Card>
          <CardHeader title="Meistgelesene Genres" subtitle="Nach beendeten Büchern" />
          <CardBody>
            <BarList
              data={stats.genres.map((genre) => ({
                label: `${genre.emoji ?? ""} ${genre.name}`.trim(),
                value: genre.books,
              }))}
              unit=" Bücher"
              emptyLabel="Noch keine gelesenen Bücher mit Genre."
            />
          </CardBody>
        </Card>
      </div>

      {/* Aktueller Lesefortschritt */}
      <Card>
        <CardHeader
          title="Aktueller Lesefortschritt"
          subtitle={
            stats.currentlyReading.length
              ? pluralize(stats.currentlyReading.length, "Buch in Arbeit", "Bücher in Arbeit")
              : "Gerade liest du nichts"
          }
        />
        <CardBody>
          {stats.currentlyReading.length ? (
            <ul className="flex flex-col gap-4">
              {stats.currentlyReading.map((book) => (
                <li key={book.id} className="flex items-center gap-4">
                  <Link href={`/books/${book.id}`} className="h-16 w-11 shrink-0 shadow-soft">
                    <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} textScale={0.38} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/books/${book.id}`} className="truncate text-sm text-ink hover:underline">
                      {book.title}
                    </Link>
                    <p className="mb-1.5 text-xs text-ink-faint tabular-nums">
                      {formatNumber(book.currentPage)}
                      {book.pageCount ? ` / ${formatNumber(book.pageCount)} Seiten` : " Seiten"} · {book.progress} %
                    </p>
                    <ProgressBar value={book.progress} height="h-2" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<TrendingUp size={20} />}
              title="Kein Buch in Arbeit"
              description="Setze ein Buch auf „Lese ich gerade“, um den Fortschritt hier zu verfolgen."
              className="py-10"
            />
          )}
        </CardBody>
      </Card>

      {/* Regal-Zusammensetzung */}
      <Card>
        <CardHeader title="Regal-Zusammensetzung" subtitle="Alle Exemplare nach Lesestatus" />
        <CardBody>
          <BarList
            data={(Object.keys(READING_STATUS_META) as (keyof typeof READING_STATUS_META)[]).map((status) => ({
              label: `${READING_STATUS_META[status].emoji} ${READING_STATUS_META[status].label}`,
              value: stats.statusCounts[status] ?? 0,
            }))}
            unit=" Bücher"
          />
          {stats.longestBook ? (
            <p className="mt-5 border-t border-ink/8 pt-4 text-sm text-ink-soft dark:border-white/8">
              Dein dickster Brocken bisher:{" "}
              <span className="text-ink">{stats.longestBook.title}</span> mit{" "}
              {formatNumber(stats.longestBook.pages)} Seiten.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-surface px-4 py-3.5 shadow-soft dark:border-white/8">
      <span className="flex items-center gap-1.5 text-[11px] tracking-wide text-ink-faint uppercase">
        {icon}
        {label}
      </span>
      <span className="mt-1.5 block font-[family-name:var(--font-display)] text-2xl text-ink tabular-nums">
        {value}
      </span>
      {hint ? <span className="block text-[11px] text-ink-faint">{hint}</span> : null}
    </div>
  );
}
