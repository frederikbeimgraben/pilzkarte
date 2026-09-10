import { VORHERSAGE_RAMPE } from '../ui/ramp/rampe-farben';

/** Farbe und Deckkraft je Byte, vier Werte je Eintrag: 256 × RGBA. */
export const LUT_GROESSE = 256 * 4;

/**
 * Wie ein Byte einer Kachel zu lesen ist.
 *
 * `wahrscheinlichkeit`: die Vorhersage einer Art. Byte 1 bis 255 tragen den
 * Wert relativ zum Höchstwert `top`; der absolute Wert ist
 * `(byte - 1) / 254 * top`, so wie ihn `modell/src/pilze/tiles.py` schreibt.
 *
 * `spanne`: eine Eingabe-Ebene. Das Rendering hat das Feld schon auf 0 bis 1
 * gestreckt (`input_layers.py`, `schreibe_feld`), der Wert ist also
 * `low + (byte - 1) / 254 * (high - low)` in der Einheit der Ebene.
 */
export type WertSkala =
  { art: 'wahrscheinlichkeit'; top: number } | { art: 'spanne'; low: number; high: number };

/**
 * Bei der Vorhersage läuft die Deckkraft mit dem Wert, bei einer Ebene nicht.
 *
 * Die Farbe der Vorhersage beantwortet „wie wahrscheinlich ist ein Fund“
 * absolut: eine Art, deren beste Zelle 0,18 erreicht, bleibt dunkel, und das
 * ist richtig so. Die Deckkraft beantwortet „wo innerhalb dieser Art sind die
 * besseren Stellen“. Eine Ebene trägt ihren Wert allein in der Farbe; liefe
 * die Deckkraft mit, sähe ein niedriger pH aus wie fehlende Daten statt wie
 * ein niedriger pH. Dieselbe Rechnung steht in `region_map.py`, `render`.
 */
const DECKKRAFT_GRUND = 0.1;
const DECKKRAFT_SPANNE = 0.85;
const DECKKRAFT_MAX = 240;
const DECKKRAFT_FLACH = 215;

/** `#0d0827` → `[13, 8, 39]`. */
export function zuRgb(farbe: string): [number, number, number] {
  const zahl = Number.parseInt(farbe.replace('#', ''), 16);
  return [(zahl >> 16) & 255, (zahl >> 8) & 255, zahl & 255];
}

/** Der Wert, den ein Byte bedeutet, in der Einheit der Quelle. */
export function werteByte(skala: WertSkala, byte: number): number {
  const relativ = (byte - 1) / 254;
  if (skala.art === 'wahrscheinlichkeit') return relativ * skala.top;
  return skala.low + relativ * (skala.high - skala.low);
}

/**
 * Ein Schlüssel, unter dem sich eine Tabelle wiederverwenden lässt. Zwei
 * Quellen mit derselben Skala und derselben Rampe färben gleich.
 */
export function skalenSchluessel(skala: WertSkala, farben: readonly string[]): string {
  const spanne =
    skala.art === 'wahrscheinlichkeit' ? String(skala.top) : `${String(skala.low)}:${String(skala.high)}`;
  return `${skala.art}|${spanne}|${farben.join(',')}`;
}

/**
 * Die Nachschlagetabelle einer Quelle: 256 Einträge zu je RGBA.
 * Byte 0 heißt „keine Daten“ und bleibt durchsichtig.
 */
export function baueLut(skala: WertSkala, farben: readonly string[] = VORHERSAGE_RAMPE): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_GROESSE);
  const stufen = farben.map(zuRgb);
  const letzte = stufen.length - 1;
  for (let byte = 1; byte < 256; byte++) {
    const relativ = (byte - 1) / 254;
    // Die Vorhersage färbt nach dem absoluten Wert, eine Ebene über ihre ganze
    // Spanne: sonst bliebe eine Ebene von 4,7 bis 6,9 pH einfarbig.
    const stelle = (skala.art === 'wahrscheinlichkeit' ? Math.min(relativ * skala.top, 1) : relativ) * letzte;
    const unten = Math.floor(stelle);
    const oben = Math.min(unten + 1, letzte);
    const anteil = stelle - unten;
    const ziel = byte * 4;
    for (let kanal = 0; kanal < 3; kanal++) {
      lut[ziel + kanal] = stufen[unten][kanal] * (1 - anteil) + stufen[oben][kanal] * anteil;
    }
    lut[ziel + 3] =
      skala.art === 'wahrscheinlichkeit'
        ? Math.min(1, DECKKRAFT_GRUND + relativ * DECKKRAFT_SPANNE) * DECKKRAFT_MAX
        : DECKKRAFT_FLACH;
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
