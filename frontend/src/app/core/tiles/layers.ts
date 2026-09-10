/**
 * Das Manifest der Eingabe-Ebenen, wie es `modell/src/pilze/input_layers.py`
 * neben die Kacheln schreibt (`layers.json`).
 *
 * Die Namen im JSON sind englisch, weil die Kette sie so schreibt. Der Parser
 * ist die einzige Stelle, die das weiß.
 */

/**
 * Die Verteilung einer Quelle über Deutschland, vorgerechnet von der Kette
 * (`modell/src/pilze/manifest.py`): 41 Kanten über die Skala, dazu 40 Anteile,
 * die sich zu 1 summieren.
 */
export interface Histogram {
  klassen: readonly number[];
  anteile: readonly number[];
}

/** Eine Eingabe-Ebene: Wald, Boden-pH, Niederschlag der letzten vier Wochen. */
export interface Layer {
  id: string;
  /** Der Name, wie ihn die Kette vergibt: „Niederschlag der letzten 4 Wochen“. */
  label: string;
  /** `mm`, `Grad`, `m` oder leer für einen Anteil. */
  unit: string;
  /** Eine feste Ebene gilt für alle Wochen; eine Wochenebene folgt der Zeitleiste. */
  fixed: boolean;
  /** Was Byte 1 und Byte 255 bedeuten, in der Einheit der Ebene. */
  low: number;
  high: number;
  /** Ordner der Kacheln. Bei einer Wochenebene fehlt die Woche noch. */
  tilePath: string;
  zoomVon: number;
  zoomBis: number;
  existing: ReadonlySet<string>;
  /** Wochenschlüssel der Form `2026W36`, aufsteigend. Leer bei fester Ebene. */
  wochen: readonly string[];
  /** Die Verteilung einer festen Ebene. */
  histogramm: Histogram | null;
  /** Je Woche eine Verteilung, bei einer Wochenebene. */
  histogramme: ReadonlyMap<string, Histogram>;
}

export interface LayersManifest {
  /** Südwest- und Nordostecke als [Länge, Breite], wie MapLibre sie erwartet. */
  bounds: readonly [readonly [number, number], readonly [number, number]];
  layers: readonly Layer[];
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

function readExisting(raw: unknown): Set<string> {
  const set = new Set<string>();
  if (!isObject(raw)) return set;
  for (const [zoom, catalogue] of Object.entries(raw)) {
    if (!Array.isArray(catalogue)) continue;
    for (const xy of catalogue) if (typeof xy === 'string') set.add(`${zoom}/${xy}`);
  }
  return set;
}

export function readHistogram(raw: unknown): Histogram | null {
  if (!isObject(raw)) return null;
  const klassen = Array.isArray(raw['klassen']) ? raw['klassen'] : [];
  const anteile = Array.isArray(raw['anteile']) ? raw['anteile'] : [];
  if (klassen.length !== anteile.length + 1 || anteile.length === 0) return null;
  return {
    klassen: klassen.map((value) => number(value)),
    anteile: anteile.map((value) => number(value)),
  };
}

function readHistograms(raw: unknown): Map<string, Histogram> {
  const alle = new Map<string, Histogram>();
  if (!isObject(raw)) return alle;
  for (const [woche, value] of Object.entries(raw)) {
    const distribution = readHistogram(value);
    if (distribution) alle.set(woche, distribution);
  }
  return alle;
}

function readLayer(id: string, raw: unknown): Layer | null {
  if (!isObject(raw) || typeof raw['tiles'] !== 'string') return null;
  const zooms = Array.isArray(raw['zooms']) ? raw['zooms'] : [];
  const wochen = Array.isArray(raw['weeks']) ? raw['weeks'] : [];
  return {
    id,
    label: typeof raw['label'] === 'string' ? raw['label'] : id,
    unit: typeof raw['unit'] === 'string' ? raw['unit'] : '',
    fixed: raw['static'] === true,
    low: number(raw['low']),
    high: number(raw['high'], 1),
    tilePath: raw['tiles'],
    zoomVon: number(zooms[0], 5),
    zoomBis: number(zooms[1], 8),
    existing: readExisting(raw['have']),
    wochen: wochen.filter((woche): woche is string => typeof woche === 'string'),
    histogramm: readHistogram(raw['histogramm']),
    histogramme: readHistograms(raw['histogramme']),
  };
}

/**
 * Liest `layers.json`. Eine Ebene ohne Kachelordner fällt weg: sie wäre in der
 * Liste sichtbar, aber auf der Karte leer.
 */
export function readLayers(raw: unknown): LayersManifest {
  const data = isObject(raw) ? raw : {};
  const bounds = Array.isArray(data['bounds']) ? data['bounds'] : [];
  const layers = isObject(data['layers']) ? data['layers'] : {};
  return {
    bounds: [corner(bounds[0]), corner(bounds[1])],
    layers: Object.entries(layers)
      .map(([id, value]) => readLayer(id, value))
      .filter((layer): layer is Layer => layer !== null),
  };
}

/** Der Schlüssel einer Woche im Manifest der Ebenen: `2026W36`. */
export function layerWeek(jahr: number, woche: number): string {
  return `${jahr}W${String(woche).padStart(2, '0')}`;
}

/**
 * Der Kachelordner einer Ebene für eine Woche.
 *
 * Die Ebenen reichen nicht immer so weit wie die Zeitleiste einer Art: das
 * Wetter endet mit der letzten gemessenen Woche, die Vorhersage läuft darüber
 * hinaus. Dann gilt die jüngste Woche, die die Ebene hat.
 */
export function layerFolders(layer: Layer, woche: string | null): string | null {
  if (layer.fixed) return layer.tilePath;
  const selected = matchingWeek(layer, woche);
  return selected === null ? null : `${layer.tilePath}/${selected}`;
}

/** Die Woche der Ebene, die für die gewählte Woche gilt. */
export function matchingWeek(layer: Layer, woche: string | null): string | null {
  if (layer.wochen.length === 0) return null;
  if (woche === null) return layer.wochen[layer.wochen.length - 1];
  // Die Schlüssel sind gleich lang, ein Vergleich als Text reicht.
  const matches = layer.wochen.filter((own) => own <= woche);
  return matches.length > 0 ? matches[matches.length - 1] : layer.wochen[0];
}

/** Die Ebenen in zwei Gruppen, je Woche zuerst. */
export function layerGroups(layers: readonly Layer[]): {
  perWeek: readonly Layer[];
  fixed: readonly Layer[];
} {
  return {
    perWeek: layers.filter((layer) => !layer.fixed),
    fixed: layers.filter((layer) => layer.fixed),
  };
}

export function findLayer(manifest: LayersManifest | null, id: string | null): Layer | null {
  if (!manifest || id === null) return null;
  return manifest.layers.find((layer) => layer.id === id) ?? null;
}

/**
 * Eine Ebene ohne Einheit, die zwischen 0 und 1 liegt, ist ein Anteil. Sie
 * liest sich als Prozent; ein Boden-pH von 4,7 bis 6,9 nicht.
 */
export function asPercent(layer: Layer): boolean {
  return layer.unit === '' && layer.low >= 0 && layer.high <= 1;
}

/** Ein Wert der Ebene ohne Einheit, in der Sprache der Oberfläche. */
export function formatNumber(value: number, layer: Layer, locale: string): string {
  if (asPercent(layer)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value * 100);
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
  }).format(value);
}

/** Die Einheit, in der die Ebene misst. Ein Anteil liest sich als Prozent. */
export function unitOf(layer: Layer): string {
  return asPercent(layer) ? '%' : layer.unit;
}

/** Ein Wert der Ebene mit seiner Einheit, in der Sprache der Oberfläche. */
export function formatValue(value: number, layer: Layer, locale: string): string {
  const unit = unitOf(layer);
  const number = formatNumber(value, layer, locale);
  return unit === '' ? number : `${number} ${unit}`;
}

/** Die Verteilung, die für eine Woche gilt. Eine feste Ebene hat nur eine. */
export function histogramFor(layer: Layer, woche: string | null): Histogram | null {
  if (layer.fixed) return layer.histogramm;
  const selected = matchingWeek(layer, woche);
  return selected === null ? null : (layer.histogramme.get(selected) ?? null);
}

/**
 * Der Anteil der Fläche, auf dem ein Wert zwischen `von` und `bis` liegt.
 *
 * Eine Klasse, die nur zum Teil in der Spanne liegt, zählt anteilig: die
 * Verteilung innerhalb einer Klasse ist unbekannt, gleichmäßig ist die
 * ehrlichste Annahme. Die Anteile summieren sich zu 1, das Ergebnis also auch.
 */
export function shareMet(histogramm: Histogram, von: number, bis: number): number {
  let sum = 0;
  for (let cssClass = 0; cssClass < histogramm.anteile.length; cssClass++) {
    const bottom = histogramm.klassen[cssClass];
    const top = histogramm.klassen[cssClass + 1];
    const breite = top - bottom;
    if (breite <= 0) continue;
    const part = Math.min(top, bis) - Math.max(bottom, von);
    if (part <= 0) continue;
    sum += histogramm.anteile[cssClass] * Math.min(part / breite, 1);
  }
  return Math.min(Math.max(sum, 0), 1);
}
