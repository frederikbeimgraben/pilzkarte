/**
 * Wie Datum, Ort und Fläche in der Oberfläche stehen.
 *
 * Die Formen kommen aus den Mockups: `Fund` schreibt „6. September 2026“,
 * `Funde` schreibt „6. Sept.“ und für den heutigen Tag „Heute“,
 * `MeldenFormular` schreibt den Ort als „48,5203 · 9,0511“.
 */

/** Vier Nachkommastellen sind rund elf Meter; genauer trifft kein Daumen. */
const ORT_STELLEN = 4;

/** Ein ISO-Datum ohne Zeit, wie es der Vertrag für `datum` verlangt. */
export function isoDatum(zeitpunkt: Date): string {
  const monat = String(zeitpunkt.getMonth() + 1).padStart(2, '0');
  const tag = String(zeitpunkt.getDate()).padStart(2, '0');
  return `${zeitpunkt.getFullYear()}-${monat}-${tag}`;
}

/**
 * Liest ein ISO-Datum als lokalen Tag. `new Date('2026-09-06')` läge in UTC
 * und verschöbe den Tag östlich der Datumsgrenze.
 */
export function alsDatum(iso: string): Date {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  return new Date(jahr, (monat || 1) - 1, tag || 1);
}

/** „6. September 2026“, so wie das Fund-Blatt es schreibt. */
export function langesDatum(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    alsDatum(iso),
  );
}

/** „6. Sept.“ in der Liste, für heute „Heute“. */
export function kurzesDatum(iso: string, locale: string, heute: string, heuteText: string): string {
  if (iso === heute) return heuteText;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(alsDatum(iso));
}

/** Ein Koordinatenpaar mit vier Stellen, in der Schreibweise der Sprache. */
export function ortText(lat: number, lon: number, locale: string): { lat: string; lon: string } {
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: ORT_STELLEN,
    maximumFractionDigits: ORT_STELLEN,
  });
  return { lat: format.format(lat), lon: format.format(lon) };
}

/** Eine Fläche in Hektar, ohne Nachkommastellen ab einem Hektar. */
export function hektarText(hektar: number, locale: string): string {
  const stellen = hektar < 10 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  }).format(hektar);
}
