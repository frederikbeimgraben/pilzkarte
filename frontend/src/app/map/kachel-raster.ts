/**
 * Das Kachelraster von Web-Mercator (XYZ), so weit die Karte es braucht.
 *
 * Die Vorhersage weiß nur, welche Kacheln es gibt und welche das Bild gerade
 * zeigt. Damit lädt sie die Nachbarwochen vor, statt eine ganze Woche blind zu
 * holen.
 */

/** Ein Ausschnitt in Grad. */
export interface Ausschnitt {
  west: number;
  sued: number;
  ost: number;
  nord: number;
}

/** Die Kachel, in der ein Punkt auf dieser Zoomstufe liegt. */
export function kachelIndex(laenge: number, breite: number, zoom: number): [number, number] {
  const n = 2 ** zoom;
  const sinus = Math.sin((Math.min(Math.max(breite, -85.05), 85.05) * Math.PI) / 180);
  const x = Math.floor(((laenge + 180) / 360) * n);
  const y = Math.floor((0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * n);
  const letzte = n - 1;
  return [Math.min(Math.max(x, 0), letzte), Math.min(Math.max(y, 0), letzte)];
}

/**
 * Die Kacheln unter dem Ausschnitt. Die Zoomstufe wird auf die Stufen des
 * Renderings geklemmt, weil MapLibre darüber hinaus dieselben Kacheln
 * hochrechnet.
 */
export function sichtbareKacheln(
  ausschnitt: Ausschnitt,
  zoom: number,
  zoomVon: number,
  zoomBis: number,
): [number, number, number][] {
  const stufe = Math.round(Math.min(Math.max(zoom, zoomVon), zoomBis));
  const [x0, y0] = kachelIndex(ausschnitt.west, ausschnitt.nord, stufe);
  const [x1, y1] = kachelIndex(ausschnitt.ost, ausschnitt.sued, stufe);
  const kacheln: [number, number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) kacheln.push([stufe, x, y]);
  return kacheln;
}
