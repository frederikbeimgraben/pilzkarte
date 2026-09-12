/**
 * Ein Kreis auf der Erde als Vieleck.
 *
 * Der Genauigkeitskreis um den eigenen Standort steht in Metern, nicht in
 * Punkten: er soll beim Zoomen mit dem Gelände wachsen. MapLibre kann einen
 * Kreis nur in Punkten zeichnen, darum wird aus dem Radius ein Vieleck.
 */

/** Meter je Grad Breite. Über die Spanne eines Genauigkeitskreises konstant. */
const METERS_PER_DEGREE = 111320;

/** So viele Ecken sehen bei jedem Zoom rund aus und bleiben klein genug. */
const STEPS = 48;

/**
 * Der Ring um `center` mit `radius` in Metern, als Ring einer GeoJSON-Fläche.
 * Der letzte Punkt wiederholt den ersten, wie GeoJSON es verlangt.
 */
export function circleAround(
  center: readonly [number, number],
  radius: number,
  steps = STEPS,
): [number, number][] {
  const [lon, lat] = center;
  const spanLat = radius / METERS_PER_DEGREE;
  // Ein Grad Länge ist am Pol kürzer als am Äquator. Ohne den Kosinus wäre der
  // Kreis in Deutschland um zwei Drittel zu breit.
  const spanLon = spanLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const ring: [number, number][] = [];
  for (let step = 0; step < steps; step++) {
    const angle = (2 * Math.PI * step) / steps;
    ring.push([lon + spanLon * Math.cos(angle), lat + spanLat * Math.sin(angle)]);
  }
  ring.push(ring[0]);
  return ring;
}
