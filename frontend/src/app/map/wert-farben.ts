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

/** Wie die Kombination gefärbt wird. */
export type KombiRegel = 'schnitt' | 'abgestuft';

/**
 * Die Schnittmenge ist eine Maske, kein Wert: eine Farbe, halb deckend, damit
 * der Wald darunter noch zu erkennen ist.
 */
export const SCHNITT_DECKKRAFT = 140;

/**
 * Wie weit außerhalb der Bedingung der Erfüllungsgrad auf null fällt: ein
 * Zehntel der Skala der Ebene. Ohne diesen Rand wäre „abgestuft“ dasselbe wie
 * die Schnittmenge, nur bunter; mit ihm bleibt sichtbar, wo es knapp ist.
 */
export const RAND_ANTEIL = 0.1;

/** Ein Punkt, für den mindestens eine Quelle keine Daten hat. */
export const LEERER_PUNKT = -1;

/** Die Bedingung eines Faktors, schon in Bytes gerechnet. */
export interface KombiGrenze {
  von: number;
  bis: number;
  /** Breite des Randes in Bytes, über den der Grad auf null fällt. */
  rand: number;
}

/** Der Erfüllungsgrad eines Faktors an einem Punkt, 0 bis 1. */
export function erfuellungsgrad(byte: number, grenze: KombiGrenze): number {
  if (byte >= grenze.von && byte <= grenze.bis) return 1;
  const abstand = byte < grenze.von ? grenze.von - byte : byte - grenze.bis;
  if (grenze.rand <= 0) return 0;
  return Math.max(0, 1 - abstand / grenze.rand);
}

/**
 * Das Ergebnis der Kombination an einem Punkt: 0 bis 1, oder {@link LEERER_PUNKT}.
 *
 * Fehlt einer Quelle der Punkt (Byte 0), bleibt der Punkt leer: eine Aussage
 * über mehrere Bedingungen braucht jede davon. Die Schnittmenge kennt nur ganz
 * oder gar nicht, „abgestuft“ nimmt das geometrische Mittel der Grade — es
 * zieht einen einzelnen schlechten Faktor stärker herunter als das
 * arithmetische, und genau das soll es.
 */
export function kombiniere(
  bytes: readonly number[],
  grenzen: readonly KombiGrenze[],
  regel: KombiRegel,
): number {
  if (bytes.length === 0) return LEERER_PUNKT;
  let produkt = 1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return LEERER_PUNKT;
    const grad = erfuellungsgrad(bytes[i], grenzen[i]);
    if (regel === 'schnitt') {
      if (grad < 1) return 0;
    } else {
      if (grad === 0) return 0;
      produkt *= grad;
    }
  }
  return regel === 'schnitt' ? 1 : produkt ** (1 / bytes.length);
}

/**
 * Die Tabelle, mit der ein Ergebnis zur Farbe wird. „Abgestuft“ liest sich wie
 * eine Vorhersage über die volle Rampe: die Farbe sagt wie gut, die Deckkraft
 * lässt schwache Stellen zurücktreten, statt das Land unter einem Schleier zu
 * begraben.
 */
export function baueKombiLut(farben: readonly string[], regel: KombiRegel): Uint8ClampedArray {
  if (regel === 'abgestuft') return baueLut({ art: 'wahrscheinlichkeit', top: 1 }, farben);
  const lut = new Uint8ClampedArray(LUT_GROESSE);
  const [r, g, b] = zuRgb(farben[0]);
  for (let byte = 1; byte < 256; byte++) {
    const ziel = byte * 4;
    lut[ziel] = r;
    lut[ziel + 1] = g;
    lut[ziel + 2] = b;
    lut[ziel + 3] = SCHNITT_DECKKRAFT;
  }
  return lut;
}

/** Der Eintrag der Tabelle, der zu einem Ergebnis gehört. */
export function kombiIndex(wert: number): number {
  if (wert <= 0) return 0;
  return 1 + Math.round(Math.min(wert, 1) * 254);
}
