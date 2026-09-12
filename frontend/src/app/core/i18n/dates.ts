/**
 * Ein Tag, wie ihn eine Person liest. Die Form kommt aus den Mockups:
 * „6. September 2026“.
 *
 * Die beiden Funktionen stehen im Kern und nicht in einer Seite: Funde, Arten
 * und Bilder schreiben denselben Tag, und jede Seite ihre eigene Fassung
 * bauen zu lassen ergäbe drei Schreibweisen.
 */

/**
 * Liest ein ISO-Datum als lokalen Tag. `new Date('2026-09-06')` läge in UTC
 * und verschöbe den Tag östlich der Datumsgrenze.
 */
export function asDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** „6. September 2026“, so wie das Fund-Blatt es schreibt. */
export function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    asDate(iso),
  );
}
