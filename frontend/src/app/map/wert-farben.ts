import { VORHERSAGE_RAMPE } from '../ui/ramp/rampe-farben';

/** Farbe und Deckkraft je Byte, vier Werte je Eintrag: 256 × RGBA. */
export const LUT_GROESSE = 256 * 4;

/**
 * Die Deckkraft läuft mit dem Wert, die Farbe nicht.
 *
 * Die Farbe beantwortet „wie wahrscheinlich ist ein Fund“ absolut: eine Art,
 * deren beste Zelle 0,18 erreicht, bleibt dunkel, und das ist richtig so. Die
 * Deckkraft beantwortet „wo innerhalb dieser Art sind die besseren Stellen“.
 * Ohne sie wäre eine schwache Art ein gleichmäßiger Schleier ohne Struktur.
 * Dieselbe Rechnung steht in `modell/src/pilze/region_map.py`.
 */
const DECKKRAFT_GRUND = 0.1;
const DECKKRAFT_SPANNE = 0.85;
const DECKKRAFT_MAX = 240;

/** `#0d0827` → `[13, 8, 39]`. */
export function zuRgb(farbe: string): [number, number, number] {
  const zahl = Number.parseInt(farbe.replace('#', ''), 16);
  return [(zahl >> 16) & 255, (zahl >> 8) & 255, zahl & 255];
}

/**
 * Die Nachschlagetabelle einer Art: 256 Einträge zu je RGBA.
 *
 * Byte 0 heißt „keine Daten“ und wird durchsichtig. Byte 1 bis 255 tragen den
 * Wert relativ zum Höchstwert `top` der Art; der absolute Wert ist
 * `(byte - 1) / 254 * top`, so wie ihn `modell/src/pilze/tiles.py` schreibt.
 */
export function baueLut(top: number, farben: readonly string[] = VORHERSAGE_RAMPE): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_GROESSE);
  const stufen = farben.map(zuRgb);
  const letzte = stufen.length - 1;
  for (let byte = 1; byte < 256; byte++) {
    const relativ = (byte - 1) / 254;
    const stelle = Math.min(relativ * top, 1) * letzte;
    const unten = Math.floor(stelle);
    const oben = Math.min(unten + 1, letzte);
    const anteil = stelle - unten;
    const ziel = byte * 4;
    for (let kanal = 0; kanal < 3; kanal++) {
      lut[ziel + kanal] = stufen[unten][kanal] * (1 - anteil) + stufen[oben][kanal] * anteil;
    }
    lut[ziel + 3] = Math.min(1, DECKKRAFT_GRUND + relativ * DECKKRAFT_SPANNE) * DECKKRAFT_MAX;
  }
  return lut;
}

/**
 * Färbt eine entpackte Kachel an Ort und Stelle. Die Wertkachel ist grau, also
 * trägt der rote Kanal jedes Punktes das Byte; die Tabelle ersetzt alle vier.
 */
export function faerbe(pixel: Uint8ClampedArray, lut: Uint8ClampedArray): void {
  for (let i = 0; i < pixel.length; i += 4) {
    const ziel = pixel[i] * 4;
    pixel[i] = lut[ziel];
    pixel[i + 1] = lut[ziel + 1];
    pixel[i + 2] = lut[ziel + 2];
    pixel[i + 3] = lut[ziel + 3];
  }
}
