/**
 * Der Weg von einem Objekt zu einer Navigation.
 *
 * Die App führt selbst nicht zum Ort: Routen, Verkehr und Sprachansage sind
 * eine eigene Anwendung. Der Knopf reicht den Punkt an Google Maps weiter.
 */

/** Sechs Nachkommastellen sind elf Zentimeter. Mehr trägt kein Fundort. */
const DIGITS = 6;

/** Die Adresse, die Google Maps auf einen Punkt führt. */
export function googleMapsUrl(location: readonly [number, number]): string {
  const [lon, lat] = location;
  const query = `${lat.toFixed(DIGITS)},${lon.toFixed(DIGITS)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Öffnet den Punkt in einem neuen Reiter. `noopener` trennt ihn von der App. */
export function openGoogleMaps(location: readonly [number, number]): void {
  window.open(googleMapsUrl(location), '_blank', 'noopener');
}
