/**
 * Das Manifest einer Vorhersage-Art, wie es `modell/src/pilze/region_map.py`
 * neben die Kacheln schreibt.
 *
 * Die Namen im JSON sind englisch, weil die Kette sie so schreibt. Der Parser
 * ist die einzige Stelle, die das weiß; nach ihm heißt alles wie in der App.
 */

import { leseHistogramm, type Histogramm } from './ebenen';

/** Eine Woche der Art. `mittel` und `hoechst` sind Wahrscheinlichkeiten, 0 bis 1. */
export interface ManifestWoche {
  jahr: number;
  woche: number;
  /** Eine Woche ohne gemessenes Wetter, aus der Vorhersage gerechnet. */
  prognose: boolean;
  /** Ordner der Kacheln dieser Woche, ohne führenden Schrägstrich. */
  kachelPfad: string;
  mittel: number;
  hoechst: number;
  /** Die Verteilung der Woche über Deutschland, 0 bis `top`. */
  histogramm: Histogramm | null;
}

/** Eine Art mit Vorhersage: Kacheln, Wochen und der Höchstwert der Rampe. */
export interface ArtManifest {
  slug: string;
  /** Die wissenschaftlichen Namen, die in die Art eingehen. */
  arten: readonly string[];
  /** Der Wert, den Byte 255 einer Kachel bedeutet. */
  top: number;
  /** Südwest- und Nordostecke als [Länge, Breite], wie MapLibre sie erwartet. */
  grenzen: readonly [readonly [number, number], readonly [number, number]];
  zoomVon: number;
  zoomBis: number;
  /** Alle Kacheln mit Daten, als `z/x/y`. Der Rest wird nie geholt. */
  vorhanden: ReadonlySet<string>;
  wochen: readonly ManifestWoche[];
}

/** `2025-40`, die Form der Wochen in der Adresse. */
export function wochenSchluessel(woche: { jahr: number; woche: number }): string {
  return `${woche.jahr}-${String(woche.woche).padStart(2, '0')}`;
}

/** Der Schlüssel einer Kachel im Verzeichnis `vorhanden`. */
export function kachelSchluessel(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null;
}

function zahl(wert: unknown, ersatz = 0): number {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : ersatz;
}

function ecke(wert: unknown): readonly [number, number] {
  // Die Kette schreibt [Breite, Länge], MapLibre erwartet [Länge, Breite].
  const paar = Array.isArray(wert) ? wert : [];
  return [zahl(paar[1]), zahl(paar[0])];
}

function leseWoche(roh: unknown): ManifestWoche | null {
  if (!istObjekt(roh) || typeof roh['tiles'] !== 'string') return null;
  return {
    jahr: zahl(roh['year']),
    woche: zahl(roh['week']),
    prognose: roh['forecast'] === true,
    kachelPfad: roh['tiles'],
    mittel: zahl(roh['mean']),
    hoechst: zahl(roh['max']),
    histogramm: leseHistogramm(roh['histogramm']),
  };
}

function leseVorhanden(roh: unknown): Set<string> {
  const menge = new Set<string>();
  if (!istObjekt(roh)) return menge;
  for (const [zoom, liste] of Object.entries(roh)) {
    if (!Array.isArray(liste)) continue;
    for (const xy of liste) if (typeof xy === 'string') menge.add(`${zoom}/${xy}`);
  }
  return menge;
}

/**
 * Liest ein Manifest. Fehlende Felder werden zu leeren Werten statt zu einem
 * Fehler: eine Art ohne Wochen zeigt eine leere Zeitleiste, sie stürzt nicht ab.
 */
export function leseManifest(roh: unknown, slug: string): ArtManifest {
  const daten = istObjekt(roh) ? roh : {};
  const kacheln = istObjekt(daten['tiles']) ? daten['tiles'] : {};
  const zooms = Array.isArray(kacheln['zooms']) ? kacheln['zooms'] : [];
  const grenzen = Array.isArray(daten['bounds']) ? daten['bounds'] : [];
  const arten = Array.isArray(daten['species']) ? daten['species'] : [];
  const wochen = Array.isArray(daten['weeks']) ? daten['weeks'] : [];
  return {
    slug,
    arten: arten.filter((name): name is string => typeof name === 'string'),
    top: zahl(daten['top'], 1),
    grenzen: [ecke(grenzen[0]), ecke(grenzen[1])],
    zoomVon: zahl(zooms[0], 5),
    zoomBis: zahl(zooms[1], 8),
    vorhanden: leseVorhanden(kacheln['have']),
    wochen: wochen.map(leseWoche).filter((woche): woche is ManifestWoche => woche !== null),
  };
}

/**
 * Die Woche, die beim Öffnen gilt: die jüngste gemessene. Gibt es nur
 * Prognosen, dann die jüngste überhaupt.
 */
export function aktuelleWoche(manifest: ArtManifest): ManifestWoche | null {
  const gemessen = manifest.wochen.filter((woche) => !woche.prognose);
  const reihe = gemessen.length > 0 ? gemessen : manifest.wochen;
  return reihe.length > 0 ? reihe[reihe.length - 1] : null;
}

/** Sucht eine Woche über ihren Schlüssel `2025-40`. */
export function findeWoche(manifest: ArtManifest, schluessel: string): ManifestWoche | null {
  return manifest.wochen.find((woche) => wochenSchluessel(woche) === schluessel) ?? null;
}

/** Alle Kacheln einer Zoomstufe, die Daten tragen. */
export function kachelnAufStufe(manifest: ArtManifest, zoom: number): [number, number, number][] {
  const kacheln: [number, number, number][] = [];
  for (const schluessel of manifest.vorhanden) {
    const [z, x, y] = schluessel.split('/').map(Number);
    if (z === zoom) kacheln.push([z, x, y]);
  }
  return kacheln;
}

/**
 * Die Balken der Zeitleiste. Der Balken ist das Mittel der Woche, relativ zur
 * besten Woche der Art; eine dunkle Karte bekommt so einen kurzen Balken.
 */
export function balkenAnteile(manifest: ArtManifest): readonly number[] {
  const spitze = Math.max(1e-9, ...manifest.wochen.map((woche) => woche.mittel));
  return manifest.wochen.map((woche) => woche.mittel / spitze);
}
