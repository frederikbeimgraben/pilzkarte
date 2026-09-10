import type { GeoPolygon } from '../../core/api/models';
import type { Ort } from './eintragen.zustand';

/** Ein Hektar sind 10 000 Quadratmeter. Turf rechnet in Quadratmetern. */
const QUADRATMETER_JE_HEKTAR = 10_000;

/** Rechnet aus einer Turf-Fläche einen Wert in Hektar. */
export type Flaechenrechner = (polygon: GeoPolygon) => number;

let geladen: Promise<Flaechenrechner> | null = null;

/**
 * Schließt einen Ring, wie es der Vertrag verlangt: der letzte Punkt ist der
 * erste. Unter drei Eckpunkten gibt es keine Fläche.
 */
export function alsPolygon(ring: readonly Ort[]): GeoPolygon | null {
  if (ring.length < 3) return null;
  const punkte: [number, number][] = ring.map(([lon, lat]) => [lon, lat]);
  const [ersterLon, ersterLat] = punkte[0];
  const [letzterLon, letzterLat] = punkte[punkte.length - 1];
  if (ersterLon !== letzterLon || ersterLat !== letzterLat) punkte.push([ersterLon, ersterLat]);
  return { type: 'Polygon', coordinates: [punkte] };
}

/**
 * Holt Turf, sobald zum ersten Mal eine Fläche gebraucht wird.
 *
 * Der Rechner liegt in einem eigenen Paket: nur wer eine Zone zeichnet oder
 * ansieht, lädt ihn, und das Erstpaket bleibt davon frei.
 */
export function ladeFlaechenrechner(): Promise<Flaechenrechner> {
  geladen ??= import('@turf/area').then((modul) => {
    const area = modul.default;
    return (polygon: GeoPolygon) => area(polygon) / QUADRATMETER_JE_HEKTAR;
  });
  return geladen;
}
