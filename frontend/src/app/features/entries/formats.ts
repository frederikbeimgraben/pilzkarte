/**
 * Wie Datum, Ort und Fläche in der Oberfläche stehen.
 *
 * Die Formen kommen aus den Mockups: `Fund` schreibt „6. September 2026“,
 * `Funde` schreibt „6. Sept.“ und für den heutigen Tag „Heute“,
 * `MeldenFormular` schreibt den Ort als „48,5203 · 9,0511“.
 */

/** Vier Nachkommastellen sind rund elf Meter; genauer trifft kein Daumen. */
const LOCATION_DIGITS = 4;

/** Ein ISO-Datum ohne Zeit, wie es der Vertrag für `datum` verlangt. */
export function isoDatum(instant: Date): string {
  const month = String(instant.getMonth() + 1).padStart(2, '0');
  const tag = String(instant.getDate()).padStart(2, '0');
  return `${instant.getFullYear()}-${month}-${tag}`;
}

/**
 * Liest ein ISO-Datum als lokalen Tag. `new Date('2026-09-06')` läge in UTC
 * und verschöbe den Tag östlich der Datumsgrenze.
 */
export function asDate(iso: string): Date {
  const [jahr, month, tag] = iso.split('-').map(Number);
  return new Date(jahr, (month || 1) - 1, tag || 1);
}

/** „6. September 2026“, so wie das Fund-Blatt es schreibt. */
export function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    asDate(iso),
  );
}

/** „6. Sept.“ in der Liste, für heute „Heute“. */
export function shortDate(iso: string, locale: string, heute: string, todayText: string): string {
  if (iso === heute) return todayText;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(asDate(iso));
}

/** Ein Koordinatenpaar mit vier Stellen, in der Schreibweise der Sprache. */
export function locationText(lat: number, lon: number, locale: string): { lat: string; lon: string } {
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: LOCATION_DIGITS,
    maximumFractionDigits: LOCATION_DIGITS,
  });
  return { lat: format.format(lat), lon: format.format(lon) };
}

/** Eine Fläche in Hektar, ohne Nachkommastellen ab einem Hektar. */
export function hectaresText(hectares: number, locale: string): string {
  const spots = hectares < 10 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: spots,
    maximumFractionDigits: spots,
  }).format(hectares);
}
