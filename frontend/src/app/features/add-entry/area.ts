import type { GeoPolygon } from '../../core/api/models';
import type { Location } from './add-entry.state';

/** Ein Hektar sind 10 000 Quadratmeter. Turf rechnet in Quadratmetern. */
const SQUARE_METRES_PER_HECTARE = 10_000;

/** Rechnet aus einer Turf-Fläche einen Wert in Hektar. */
export type AreaCalculator = (polygon: GeoPolygon) => number;

let loaded: Promise<AreaCalculator> | null = null;

/**
 * Schließt einen Ring, wie es der Vertrag verlangt: der letzte Punkt ist der
 * erste. Unter drei Eckpunkten gibt es keine Fläche.
 */
export function asPolygon(ring: readonly Location[]): GeoPolygon | null {
  if (ring.length < 3) return null;
  const punkte: [number, number][] = ring.map(([lon, lat]) => [lon, lat]);
  const [firstLon, firstLat] = punkte[0];
  const [lastLon, lastLat] = punkte[punkte.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) punkte.push([firstLon, firstLat]);
  return { type: 'Polygon', coordinates: [punkte] };
}

/**
 * Holt Turf, sobald zum ersten Mal eine Fläche gebraucht wird.
 *
 * Der Rechner liegt in einem eigenen Paket: nur wer eine Zone zeichnet oder
 * ansieht, lädt ihn, und das Erstpaket bleibt davon frei.
 */
export function loadAreaCalculator(): Promise<AreaCalculator> {
  loaded ??= import('@turf/area').then((module) => {
    const area = module.default;
    return (polygon: GeoPolygon) => area(polygon) / SQUARE_METRES_PER_HECTARE;
  });
  return loaded;
}
