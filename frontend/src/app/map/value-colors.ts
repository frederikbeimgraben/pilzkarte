import { FORECAST_RAMP } from '../ui/ramp/ramp-colors';

/** Farbe und Deckkraft je Byte, vier Werte je Eintrag: 256 × RGBA. */
export const LUT_SIZE = 256 * 4;

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
export type ValueScale =
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
const OPACITY_BASE = 0.1;
const OPACITY_RANGE = 0.85;
const OPACITY_MAX = 240;
const OPACITY_FLAT = 215;

/** `#0d0827` → `[13, 8, 39]`. */
export function zuRgb(farbe: string): [number, number, number] {
  const number = Number.parseInt(farbe.replace('#', ''), 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

/** Der Wert, den ein Byte bedeutet, in der Einheit der Quelle. */
export function valueBytes(scale: ValueScale, byte: number): number {
  const relative = (byte - 1) / 254;
  if (scale.art === 'wahrscheinlichkeit') return relative * scale.top;
  return scale.low + relative * (scale.high - scale.low);
}

/**
 * Ein Schlüssel, unter dem sich eine Tabelle wiederverwenden lässt. Zwei
 * Quellen mit derselben Skala und derselben Rampe färben gleich.
 */
export function scaleKey(scale: ValueScale, colors: readonly string[]): string {
  const span =
    scale.art === 'wahrscheinlichkeit' ? String(scale.top) : `${String(scale.low)}:${String(scale.high)}`;
  return `${scale.art}|${span}|${colors.join(',')}`;
}

/**
 * Die Nachschlagetabelle einer Quelle: 256 Einträge zu je RGBA.
 * Byte 0 heißt „keine Daten“ und bleibt durchsichtig.
 */
export function createLut(scale: ValueScale, colors: readonly string[] = FORECAST_RAMP): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const levels = colors.map(zuRgb);
  const last = levels.length - 1;
  for (let byte = 1; byte < 256; byte++) {
    const relative = (byte - 1) / 254;
    // Die Vorhersage färbt nach dem absoluten Wert, eine Ebene über ihre ganze
    // Spanne: sonst bliebe eine Ebene von 4,7 bis 6,9 pH einfarbig.
    const spot = (scale.art === 'wahrscheinlichkeit' ? Math.min(relative * scale.top, 1) : relative) * last;
    const bottom = Math.floor(spot);
    const top = Math.min(bottom + 1, last);
    const share = spot - bottom;
    const target = byte * 4;
    for (let channel = 0; channel < 3; channel++) {
      lut[target + channel] = levels[bottom][channel] * (1 - share) + levels[top][channel] * share;
    }
    lut[target + 3] =
      scale.art === 'wahrscheinlichkeit'
        ? Math.min(1, OPACITY_BASE + relative * OPACITY_RANGE) * OPACITY_MAX
        : OPACITY_FLAT;
  }
  return lut;
}

/**
 * Färbt eine entpackte Kachel an Ort und Stelle. Die Wertkachel ist grau, also
 * trägt der rote Kanal jedes Punktes das Byte; die Tabelle ersetzt alle vier.
 */
export function colorize(pixel: Uint8ClampedArray, lut: Uint8ClampedArray): void {
  for (let i = 0; i < pixel.length; i += 4) {
    const target = pixel[i] * 4;
    pixel[i] = lut[target];
    pixel[i + 1] = lut[target + 1];
    pixel[i + 2] = lut[target + 2];
    pixel[i + 3] = lut[target + 3];
  }
}

/** Wie die Kombination gefärbt wird. */
export type CombinationRule = 'schnitt' | 'abgestuft';

/**
 * Die Schnittmenge ist eine Maske, kein Wert: eine Farbe, halb deckend, damit
 * der Wald darunter noch zu erkennen ist.
 */
export const INTERSECTION_OPACITY = 140;

/**
 * Wie weit außerhalb der Bedingung der Erfüllungsgrad auf null fällt: ein
 * Zehntel der Skala der Ebene. Ohne diesen Rand wäre „abgestuft“ dasselbe wie
 * die Schnittmenge, nur bunter; mit ihm bleibt sichtbar, wo es knapp ist.
 */
export const EDGE_SHARE = 0.1;

/** Ein Punkt, für den mindestens eine Quelle keine Daten hat. */
export const EMPTY_DOT = -1;

/** Die Bedingung eines Faktors, schon in Bytes gerechnet. */
export interface CombinationBound {
  von: number;
  bis: number;
  /** Breite des Randes in Bytes, über den der Grad auf null fällt. */
  edge: number;
}

/** Der Erfüllungsgrad eines Faktors an einem Punkt, 0 bis 1. */
export function fulfilment(byte: number, bound: CombinationBound): number {
  if (byte >= bound.von && byte <= bound.bis) return 1;
  const gap = byte < bound.von ? bound.von - byte : byte - bound.bis;
  if (bound.edge <= 0) return 0;
  return Math.max(0, 1 - gap / bound.edge);
}

/**
 * Das Ergebnis der Kombination an einem Punkt: 0 bis 1, oder {@link EMPTY_DOT}.
 *
 * Fehlt einer Quelle der Punkt (Byte 0), bleibt der Punkt leer: eine Aussage
 * über mehrere Bedingungen braucht jede davon. Die Schnittmenge kennt nur ganz
 * oder gar nicht, „abgestuft“ nimmt das geometrische Mittel der Grade — es
 * zieht einen einzelnen schlechten Faktor stärker herunter als das
 * arithmetische, und genau das soll es.
 */
export function combine(
  bytes: readonly number[],
  bounds: readonly CombinationBound[],
  rule: CombinationRule,
): number {
  if (bytes.length === 0) return EMPTY_DOT;
  let product = 1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return EMPTY_DOT;
    const degree = fulfilment(bytes[i], bounds[i]);
    if (rule === 'schnitt') {
      if (degree < 1) return 0;
    } else {
      if (degree === 0) return 0;
      product *= degree;
    }
  }
  return rule === 'schnitt' ? 1 : product ** (1 / bytes.length);
}

/**
 * Die Tabelle, mit der ein Ergebnis zur Farbe wird. „Abgestuft“ liest sich wie
 * eine Vorhersage über die volle Rampe: die Farbe sagt wie gut, die Deckkraft
 * lässt schwache Stellen zurücktreten, statt das Land unter einem Schleier zu
 * begraben.
 */
export function createCombinationLut(colors: readonly string[], rule: CombinationRule): Uint8ClampedArray {
  if (rule === 'abgestuft') return createLut({ art: 'wahrscheinlichkeit', top: 1 }, colors);
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const [r, g, b] = zuRgb(colors[0]);
  for (let byte = 1; byte < 256; byte++) {
    const target = byte * 4;
    lut[target] = r;
    lut[target + 1] = g;
    lut[target + 2] = b;
    lut[target + 3] = INTERSECTION_OPACITY;
  }
  return lut;
}

/** Der Eintrag der Tabelle, der zu einem Ergebnis gehört. */
export function combinationIndex(value: number): number {
  if (value <= 0) return 0;
  return 1 + Math.round(Math.min(value, 1) * 254);
}
