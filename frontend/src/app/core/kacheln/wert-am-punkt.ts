import { kachelPfad } from './kachel-pfade';
import { kachelSchluessel, type ArtManifest } from './manifest';

/** Eine Wertkachel ist 256 Punkte breit, so wie das Rendering sie schreibt. */
const KACHEL_PUNKTE = 256;

/**
 * Der Ort einer Kachel und der Punkt darin. Getrennt von der Rechnung, damit
 * ein Test das Raster ohne Bild prüfen kann.
 */
export interface Kachelort {
  z: number;
  x: number;
  y: number;
  punktX: number;
  punktY: number;
}

/** Rechnet Länge und Breite auf Kachel und Punkt einer Zoomstufe um. */
export function kachelort(lon: number, lat: number, zoom: number): Kachelort {
  const n = 2 ** zoom;
  const sinus = Math.sin((Math.min(Math.max(lat, -85.05), 85.05) * Math.PI) / 180);
  const genauX = ((lon + 180) / 360) * n;
  const genauY = (0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * n;
  const x = Math.min(Math.max(Math.floor(genauX), 0), n - 1);
  const y = Math.min(Math.max(Math.floor(genauY), 0), n - 1);
  return {
    z: zoom,
    x,
    y,
    punktX: Math.min(KACHEL_PUNKTE - 1, Math.floor((genauX - x) * KACHEL_PUNKTE)),
    punktY: Math.min(KACHEL_PUNKTE - 1, Math.floor((genauY - y) * KACHEL_PUNKTE)),
  };
}

/**
 * Rechnet das Byte einer Wertkachel in eine Wahrscheinlichkeit um. Byte 0
 * heißt „keine Daten“; sonst gilt `(byte - 1) / 254 * top`, dieselbe Rechnung
 * wie in `modell/src/pilze/tiles.py`.
 */
export function wertAusByte(byte: number, top: number): number | null {
  return byte === 0 ? null : ((byte - 1) / 254) * top;
}

/**
 * Die Vorhersage an einem Ort, aus der feinsten vorhandenen Kachel der Woche.
 *
 * Der Wert kommt aus derselben Kachel, die die Karte färbt; ein eigener
 * Endpunkt dafür wäre eine zweite Wahrheit. Ohne Kachel, ohne Leinwand oder
 * ohne Netz gibt es keinen Wert, und das Blatt zeigt die Zeile dann nicht.
 */
export async function wertAmPunkt(
  manifest: ArtManifest,
  wochenOrdner: string,
  lon: number,
  lat: number,
): Promise<number | null> {
  for (let zoom = manifest.zoomBis; zoom >= manifest.zoomVon; zoom--) {
    const ort = kachelort(lon, lat, zoom);
    if (!manifest.vorhanden.has(kachelSchluessel(ort.z, ort.x, ort.y))) continue;
    const byte = await liesByte(kachelPfad(wochenOrdner, ort.z, ort.x, ort.y), ort);
    if (byte !== null) return wertAusByte(byte, manifest.top);
  }
  return null;
}

async function liesByte(url: string, ort: Kachelort): Promise<number | null> {
  try {
    const antwort = await fetch(url);
    if (!antwort.ok) return null;
    const bild = await createImageBitmap(await antwort.blob());
    const leinwand = new OffscreenCanvas(bild.width, bild.height);
    const stift = leinwand.getContext('2d', { willReadFrequently: true });
    if (!stift) return null;
    stift.drawImage(bild, 0, 0);
    bild.close();
    // Die Wertkachel ist grau: der rote Kanal trägt das Byte.
    return stift.getImageData(ort.punktX, ort.punktY, 1, 1).data[0];
  } catch {
    return null;
  }
}
