/**
 * Wie Datum, Ort und Fläche in der Oberfläche stehen. Der lange Tag steht im
 * Kern, weil ihn auch Arten und Bilder schreiben.
 *
 * Die Formen kommen aus den Mockups: `Fund` schreibt „6. September 2026“ und
 * `Funde` schreibt „6. Sept.“, für den heutigen Tag „Heute“. Der Ort steht im
 * Kern, weil ihn auch die Bilder schreiben.
 */

import { asDate } from '../../core/i18n/dates';

/** Ein ISO-Datum ohne Zeit, wie es der Vertrag für `datum` verlangt. */
export function isoDatum(instant: Date): string {
  const month = String(instant.getMonth() + 1).padStart(2, '0');
  const tag = String(instant.getDate()).padStart(2, '0');
  return `${instant.getFullYear()}-${month}-${tag}`;
}

/** „6. Sept.“ in der Liste, für heute „Heute“. */
export function shortDate(iso: string, locale: string, heute: string, todayText: string): string {
  if (iso === heute) return todayText;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(asDate(iso));
}

/** Eine Fläche in Hektar, ohne Nachkommastellen ab einem Hektar. */
export function hectaresText(hectares: number, locale: string): string {
  const spots = hectares < 10 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: spots,
    maximumFractionDigits: spots,
  }).format(hectares);
}
