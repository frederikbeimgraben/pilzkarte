import { tilePath } from './tile-paths';
import { tileKey, type SpeciesManifest } from './manifest';

/** Eine Wertkachel ist 256 Punkte breit, so wie das Rendering sie schreibt. */
const TILE_PIXELS = 256;

/**
 * Der Ort einer Kachel und der Punkt darin. Getrennt von der Rechnung, damit
 * ein Test das Raster ohne Bild prüfen kann.
 */
export interface TileLocation {
  z: number;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
}

/** Rechnet Länge und Breite auf Kachel und Punkt einer Zoomstufe um. */
export function tileLocation(lon: number, lat: number, zoom: number): TileLocation {
  const n = 2 ** zoom;
  const sinus = Math.sin((Math.min(Math.max(lat, -85.05), 85.05) * Math.PI) / 180);
  const exactX = ((lon + 180) / 360) * n;
  const exactY = (0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * n;
  const x = Math.min(Math.max(Math.floor(exactX), 0), n - 1);
  const y = Math.min(Math.max(Math.floor(exactY), 0), n - 1);
  return {
    z: zoom,
    x,
    y,
    pixelX: Math.min(TILE_PIXELS - 1, Math.floor((exactX - x) * TILE_PIXELS)),
    pixelY: Math.min(TILE_PIXELS - 1, Math.floor((exactY - y) * TILE_PIXELS)),
  };
}

/**
 * Rechnet das Byte einer Wertkachel in eine Wahrscheinlichkeit um. Byte 0
 * heißt „keine Daten“; sonst gilt `(byte - 1) / 254 * top`, dieselbe Rechnung
 * wie in `modell/src/pilze/tiles.py`.
 */
export function valueFromByte(byte: number, top: number): number | null {
  return byte === 0 ? null : ((byte - 1) / 254) * top;
}

/**
 * Die Vorhersage an einem Ort, aus der feinsten vorhandenen Kachel der Woche.
 *
 * Der Wert kommt aus derselben Kachel, die die Karte färbt; ein eigener
 * Endpunkt dafür wäre eine zweite Wahrheit. Ohne Kachel, ohne Leinwand oder
 * ohne Netz gibt es keinen Wert, und das Blatt zeigt die Zeile dann nicht.
 */
export async function valueAtPoint(
  manifest: SpeciesManifest,
  weekFolder: string,
  lon: number,
  lat: number,
): Promise<number | null> {
  for (let zoom = manifest.zoomBis; zoom >= manifest.zoomVon; zoom--) {
    const location = tileLocation(lon, lat, zoom);
    if (!manifest.existing.has(tileKey(location.z, location.x, location.y))) continue;
    const byte = await readByte(tilePath(weekFolder, location.z, location.x, location.y), location);
    if (byte !== null) return valueFromByte(byte, manifest.top);
  }
  return null;
}

async function readByte(url: string, location: TileLocation): Promise<number | null> {
  try {
    const reply = await fetch(url);
    if (!reply.ok) return null;
    const shot = await createImageBitmap(await reply.blob());
    const canvas = new OffscreenCanvas(shot.width, shot.height);
    const pen = canvas.getContext('2d', { willReadFrequently: true });
    if (!pen) return null;
    pen.drawImage(shot, 0, 0);
    shot.close();
    // Die Wertkachel ist grau: der rote Kanal trägt das Byte.
    return pen.getImageData(location.pixelX, location.pixelY, 1, 1).data[0];
  } catch {
    return null;
  }
}
