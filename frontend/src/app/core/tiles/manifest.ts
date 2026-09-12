/**
 * Das Manifest einer Vorhersage-Art, wie es `modell/src/pilze/region_map.py`
 * neben die Kacheln schreibt.
 *
 * Die Namen im JSON sind englisch, weil die Kette sie so schreibt. Der Parser
 * ist die einzige Stelle, die das weiß; nach ihm heißt alles wie in der App.
 */

import { readHistogram, type Histogram } from './layers';

/** Eine Woche der Art. `mittel` und `hoechst` sind Wahrscheinlichkeiten, 0 bis 1. */
export interface ManifestWeek {
  jahr: number;
  woche: number;
  /** Eine Woche ohne gemessenes Wetter, aus der Vorhersage gerechnet. */
  forecast: boolean;
  /** Ordner der Kacheln dieser Woche, ohne führenden Schrägstrich. */
  tilePath: string;
  mean: number;
  max: number;
  /** Die Verteilung der Woche über Deutschland, 0 bis `top`. */
  histogramm: Histogram | null;
}

/** Eine Art mit Vorhersage: Kacheln, Wochen und der Höchstwert der Rampe. */
export interface SpeciesManifest {
  slug: string;
  /** Die wissenschaftlichen Namen, die in die Art eingehen. */
  arten: readonly string[];
  /** Der Wert, den Byte 255 einer Kachel bedeutet. */
  top: number;
  /** Südwest- und Nordostecke als [Länge, Breite], wie MapLibre sie erwartet. */
  bounds: readonly [readonly [number, number], readonly [number, number]];
  zoomVon: number;
  zoomBis: number;
  /** Alle Kacheln mit Daten, als `z/x/y`. Der Rest wird nie geholt. */
  existing: ReadonlySet<string>;
  wochen: readonly ManifestWeek[];
}

/** `2025-40`, die Form der Wochen in der Adresse. */
export function weekKey(woche: { jahr: number; woche: number }): string {
  return `${woche.jahr}-${String(woche.woche).padStart(2, '0')}`;
}

/** Der Schlüssel einer Kachel im Verzeichnis `vorhanden`. */
export function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function corner(value: unknown): readonly [number, number] {
  // Die Kette schreibt [Breite, Länge], MapLibre erwartet [Länge, Breite].
  const pair = Array.isArray(value) ? value : [];
  return [number(pair[1]), number(pair[0])];
}

function readWeek(raw: unknown): ManifestWeek | null {
  if (!isObject(raw) || typeof raw['tiles'] !== 'string') return null;
  return {
    jahr: number(raw['year']),
    woche: number(raw['week']),
    forecast: raw['forecast'] === true,
    tilePath: raw['tiles'],
    mean: number(raw['mean']),
    max: number(raw['max']),
    histogramm: readHistogram(raw['histogramm']),
  };
}

function readExisting(raw: unknown): Set<string> {
  const set = new Set<string>();
  if (!isObject(raw)) return set;
  for (const [zoom, catalogue] of Object.entries(raw)) {
    if (!Array.isArray(catalogue)) continue;
    for (const xy of catalogue) if (typeof xy === 'string') set.add(`${zoom}/${xy}`);
  }
  return set;
}

/**
 * Liest ein Manifest. Fehlende Felder werden zu leeren Werten statt zu einem
 * Fehler: eine Art ohne Wochen zeigt eine leere Zeitleiste, sie stürzt nicht ab.
 */
export function readManifest(raw: unknown, slug: string): SpeciesManifest {
  const data = isObject(raw) ? raw : {};
  const tiles = isObject(data['tiles']) ? data['tiles'] : {};
  const zooms = Array.isArray(tiles['zooms']) ? tiles['zooms'] : [];
  const bounds = Array.isArray(data['bounds']) ? data['bounds'] : [];
  const arten = Array.isArray(data['species']) ? data['species'] : [];
  const wochen = Array.isArray(data['weeks']) ? data['weeks'] : [];
  return {
    slug,
    arten: arten.filter((name): name is string => typeof name === 'string'),
    top: number(data['top'], 1),
    bounds: [corner(bounds[0]), corner(bounds[1])],
    zoomVon: number(zooms[0], 5),
    zoomBis: number(zooms[1], 8),
    existing: readExisting(tiles['have']),
    wochen: wochen.map(readWeek).filter((woche): woche is ManifestWeek => woche !== null),
  };
}

/**
 * Die ISO-Kalenderwoche eines Tages.
 *
 * Der Donnerstag entscheidet, zu welchem Jahr eine Woche gehört; das ist die
 * Regel der ISO 8601 und dieselbe, nach der die Kette ihre Wochen zählt.
 */
export function isoWoche(datum: Date): { jahr: number; woche: number } {
  const tag = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  tag.setUTCDate(tag.getUTCDate() + 4 - (tag.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tag.getUTCFullYear(), 0, 1));
  const tage = (tag.getTime() - yearStart.getTime()) / 86400000;
  return { jahr: tag.getUTCFullYear(), woche: Math.ceil((tage + 1) / 7) };
}

/**
 * Die Woche, die beim Öffnen gilt: die laufende Kalenderwoche, wenn das
 * Manifest sie hat, auch als Prognose. Wer die App im Herbst öffnet, will
 * diese Woche sehen und nicht die letzte gemessene. Reicht das Manifest nicht
 * so weit, gilt seine jüngste Woche.
 */
export function currentWeek(manifest: SpeciesManifest, heute = new Date()): ManifestWeek | null {
  if (manifest.wochen.length === 0) return null;
  const jetzt = isoWoche(heute);
  const current = manifest.wochen.find((woche) => woche.jahr === jetzt.jahr && woche.woche === jetzt.woche);
  return current ?? manifest.wochen[manifest.wochen.length - 1];
}

/** Sucht eine Woche über ihren Schlüssel `2025-40`. */
export function findWeek(manifest: SpeciesManifest, schluessel: string): ManifestWeek | null {
  return manifest.wochen.find((woche) => weekKey(woche) === schluessel) ?? null;
}

/** Alle Kacheln einer Zoomstufe, die Daten tragen. */
export function tilesAtZoom(manifest: SpeciesManifest, zoom: number): [number, number, number][] {
  const tiles: [number, number, number][] = [];
  for (const schluessel of manifest.existing) {
    const [z, x, y] = schluessel.split('/').map(Number);
    if (z === zoom) tiles.push([z, x, y]);
  }
  return tiles;
}

/**
 * Die Balken der Zeitleiste. Der Balken ist das Mittel der Woche, relativ zur
 * besten Woche der Art; eine dunkle Karte bekommt so einen kurzen Balken.
 */
export function barShares(manifest: SpeciesManifest): readonly number[] {
  const peak = Math.max(1e-9, ...manifest.wochen.map((woche) => woche.mean));
  return manifest.wochen.map((woche) => woche.mean / peak);
}
