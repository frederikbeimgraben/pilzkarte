/**
 * Das Manifest der Eingabe-Ebenen, wie es `modell/src/pilze/input_layers.py`
 * neben die Kacheln schreibt (`layers.json`).
 *
 * Die Namen im JSON sind englisch, weil die Kette sie so schreibt. Der Parser
 * ist die einzige Stelle, die das weiß.
 */

/** Eine Eingabe-Ebene: Wald, Boden-pH, Niederschlag der letzten vier Wochen. */
export interface Ebene {
  id: string;
  /** Der Name, wie ihn die Kette vergibt: „Niederschlag der letzten 4 Wochen“. */
  label: string;
  /** `mm`, `Grad`, `m` oder leer für einen Anteil. */
  einheit: string;
  /** Eine feste Ebene gilt für alle Wochen; eine Wochenebene folgt der Zeitleiste. */
  fest: boolean;
  /** Was Byte 1 und Byte 255 bedeuten, in der Einheit der Ebene. */
  low: number;
  high: number;
  /** Ordner der Kacheln. Bei einer Wochenebene fehlt die Woche noch. */
  kachelPfad: string;
  zoomVon: number;
  zoomBis: number;
  vorhanden: ReadonlySet<string>;
  /** Wochenschlüssel der Form `2026W36`, aufsteigend. Leer bei fester Ebene. */
  wochen: readonly string[];
}

export interface EbenenManifest {
  /** Südwest- und Nordostecke als [Länge, Breite], wie MapLibre sie erwartet. */
  grenzen: readonly [readonly [number, number], readonly [number, number]];
  ebenen: readonly Ebene[];
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

function leseVorhanden(roh: unknown): Set<string> {
  const menge = new Set<string>();
  if (!istObjekt(roh)) return menge;
  for (const [zoom, liste] of Object.entries(roh)) {
    if (!Array.isArray(liste)) continue;
    for (const xy of liste) if (typeof xy === 'string') menge.add(`${zoom}/${xy}`);
  }
  return menge;
}

function leseEbene(id: string, roh: unknown): Ebene | null {
  if (!istObjekt(roh) || typeof roh['tiles'] !== 'string') return null;
  const zooms = Array.isArray(roh['zooms']) ? roh['zooms'] : [];
  const wochen = Array.isArray(roh['weeks']) ? roh['weeks'] : [];
  return {
    id,
    label: typeof roh['label'] === 'string' ? roh['label'] : id,
    einheit: typeof roh['unit'] === 'string' ? roh['unit'] : '',
    fest: roh['static'] === true,
    low: zahl(roh['low']),
    high: zahl(roh['high'], 1),
    kachelPfad: roh['tiles'],
    zoomVon: zahl(zooms[0], 5),
    zoomBis: zahl(zooms[1], 8),
    vorhanden: leseVorhanden(roh['have']),
    wochen: wochen.filter((woche): woche is string => typeof woche === 'string'),
  };
}

/**
 * Liest `layers.json`. Eine Ebene ohne Kachelordner fällt weg: sie wäre in der
 * Liste sichtbar, aber auf der Karte leer.
 */
export function leseEbenen(roh: unknown): EbenenManifest {
  const daten = istObjekt(roh) ? roh : {};
  const grenzen = Array.isArray(daten['bounds']) ? daten['bounds'] : [];
  const ebenen = istObjekt(daten['layers']) ? daten['layers'] : {};
  return {
    grenzen: [ecke(grenzen[0]), ecke(grenzen[1])],
    ebenen: Object.entries(ebenen)
      .map(([id, wert]) => leseEbene(id, wert))
      .filter((ebene): ebene is Ebene => ebene !== null),
  };
}

/** Der Schlüssel einer Woche im Manifest der Ebenen: `2026W36`. */
export function ebenenWoche(jahr: number, woche: number): string {
  return `${jahr}W${String(woche).padStart(2, '0')}`;
}

/**
 * Der Kachelordner einer Ebene für eine Woche.
 *
 * Die Ebenen reichen nicht immer so weit wie die Zeitleiste einer Art: das
 * Wetter endet mit der letzten gemessenen Woche, die Vorhersage läuft darüber
 * hinaus. Dann gilt die jüngste Woche, die die Ebene hat.
 */
export function ebenenOrdner(ebene: Ebene, woche: string | null): string | null {
  if (ebene.fest) return ebene.kachelPfad;
  const gewaehlt = passendeWoche(ebene, woche);
  return gewaehlt === null ? null : `${ebene.kachelPfad}/${gewaehlt}`;
}

/** Die Woche der Ebene, die für die gewählte Woche gilt. */
export function passendeWoche(ebene: Ebene, woche: string | null): string | null {
  if (ebene.wochen.length === 0) return null;
  if (woche === null) return ebene.wochen[ebene.wochen.length - 1];
  // Die Schlüssel sind gleich lang, ein Vergleich als Text reicht.
  const treffer = ebene.wochen.filter((eigene) => eigene <= woche);
  return treffer.length > 0 ? treffer[treffer.length - 1] : ebene.wochen[0];
}

/** Die Ebenen in zwei Gruppen, je Woche zuerst. */
export function ebenenGruppen(ebenen: readonly Ebene[]): {
  jeWoche: readonly Ebene[];
  fest: readonly Ebene[];
} {
  return {
    jeWoche: ebenen.filter((ebene) => !ebene.fest),
    fest: ebenen.filter((ebene) => ebene.fest),
  };
}

export function findeEbene(manifest: EbenenManifest | null, id: string | null): Ebene | null {
  if (!manifest || id === null) return null;
  return manifest.ebenen.find((ebene) => ebene.id === id) ?? null;
}

/**
 * Eine Ebene ohne Einheit, die zwischen 0 und 1 liegt, ist ein Anteil. Sie
 * liest sich als Prozent; ein Boden-pH von 4,7 bis 6,9 nicht.
 */
export function alsProzent(ebene: Ebene): boolean {
  return ebene.einheit === '' && ebene.low >= 0 && ebene.high <= 1;
}

/** Ein Wert der Ebene mit seiner Einheit, in der Sprache der Oberfläche. */
export function formatiereWert(wert: number, ebene: Ebene, locale: string): string {
  if (alsProzent(ebene)) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(wert * 100)} %`;
  }
  const zahl = new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(wert) >= 100 ? 0 : 1,
  }).format(wert);
  return ebene.einheit === '' ? zahl : `${zahl} ${ebene.einheit}`;
}
