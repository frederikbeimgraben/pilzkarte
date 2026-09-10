import { formatValue, formatNumber, type Layer } from '../../core/tiles/layers';
import { EDGE_SHARE, type CombinationBound } from '../../map/value-colors';

/** Die drei Formen einer Bedingung. Alle drei sind eine Spanne über der Skala. */
export type Condition = 'unter' | 'ueber' | 'zwischen';

/**
 * Ein Faktor der Kombination: eine Quelle mit einer Bedingung.
 *
 * `von` und `bis` stehen in der Einheit der Quelle. Bei „unter“ zählt nur
 * `bis`, bei „über“ nur `von`; die andere Grenze kommt von der Skala.
 */
export interface Faktor {
  source: string;
  condition: Condition;
  von: number;
  bis: number;
  active: boolean;
}

/**
 * Die vier Faktoren, mit denen die Kombination aufgeht: das Beispiel aus dem
 * Konzept und dem Artboard `Kombination`.
 */
export const DEFAULT_FACTORS: readonly Faktor[] = [
  { source: 'regen_4w', condition: 'ueber', von: 80, bis: 0, active: true },
  { source: 'temperatur', condition: 'zwischen', von: 8, bis: 16, active: true },
  { source: 'buche', condition: 'ueber', von: 0.3, bis: 0, active: true },
  { source: 'hangneigung', condition: 'unter', von: 0, bis: 15, active: true },
];

/** Kurzform der Bedingung in der Adresse. */
const SHORT: Record<Condition, string> = { unter: 'le', ueber: 'ge', zwischen: 'zw' };

const FROM_SHORT: Record<string, Condition> = { le: 'unter', ge: 'ueber', zw: 'zwischen' };

const SOURCE_PATTERN = /^[a-z0-9_]{1,40}$/;

/**
 * Die Kombination als ein Wert der Adresse:
 * `regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3`. Ein abgehakter Faktor
 * trägt ein Ausrufezeichen vorn, damit er beim Teilen nicht verloren geht.
 */
export function encodeFactors(factors: readonly Faktor[]): string {
  return factors.map(encodeFactor).join(',');
}

function encodeFactor(factor: Faktor): string {
  const head = `${factor.active ? '' : '!'}${factor.source}:${SHORT[factor.condition]}`;
  if (factor.condition === 'zwischen') return `${head}:${numberText(factor.von)}:${numberText(factor.bis)}`;
  return `${head}:${numberText(factor.condition === 'unter' ? factor.bis : factor.von)}`;
}

/** Ohne Nachkommastellen, wo keine nötig sind: `0.3`, aber `80`. */
function numberText(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function readFactors(text: string | null): Faktor[] {
  if (text === null || text === '') return [];
  return text
    .split(',')
    .map(readFactor)
    .filter((factor): factor is Faktor => factor !== null);
}

function readFactor(text: string): Faktor | null {
  const parts = text.split(':');
  const active = !parts[0].startsWith('!');
  const source = active ? parts[0] : parts[0].slice(1);
  const condition = FROM_SHORT[parts[1]] as Condition | undefined;
  if (!SOURCE_PATTERN.test(source) || !condition) return null;
  const first = Number(parts[2]);
  const second = Number(parts[3]);
  if (!Number.isFinite(first)) return null;
  if (condition === 'zwischen') {
    if (!Number.isFinite(second)) return null;
    return { source, condition, von: Math.min(first, second), bis: Math.max(first, second), active };
  }
  return {
    source,
    condition,
    von: condition === 'ueber' ? first : 0,
    bis: condition === 'unter' ? first : 0,
    active,
  };
}

/** Die Bedingung als Spanne über der Skala der Quelle, in ihrer Einheit. */
export function span(factor: Faktor, layer: Layer): { von: number; bis: number } {
  if (factor.condition === 'unter') return { von: layer.low, bis: factor.bis };
  if (factor.condition === 'ueber') return { von: factor.von, bis: layer.high };
  return { von: factor.von, bis: factor.bis };
}

/** Die Bedingung in Worten: `≥ 80 mm`, `≤ 15 Grad`, `8 bis 16 Grad`. */
export function conditionText(factor: Faktor, layer: Layer, locale: string, bis: string): string {
  if (factor.condition === 'unter') return `≤ ${formatValue(factor.bis, layer, locale)}`;
  if (factor.condition === 'ueber') return `≥ ${formatValue(factor.von, layer, locale)}`;
  // Die Einheit steht einmal, am Ende: „8 bis 16 Grad“, nicht zweimal.
  const links = formatNumber(factor.von, layer, locale);
  return `${links} ${bis} ${formatValue(factor.bis, layer, locale)}`;
}

/**
 * Der Wert als Byte der Wertkachel. Byte 0 heißt „keine Daten“, die Skala
 * beginnt darum bei 1.
 */
export function byteForValue(layer: Layer, value: number): number {
  const breite = layer.high - layer.low;
  const relative = breite === 0 ? 0 : (value - layer.low) / breite;
  return Math.min(255, Math.max(1, Math.round(1 + relative * 254)));
}

/** Die Bedingung, wie der Worker sie braucht: in Bytes, mit Randbreite. */
export function boundFor(factor: Faktor, layer: Layer): CombinationBound {
  const values = span(factor, layer);
  return {
    von: byteForValue(layer, values.von),
    bis: byteForValue(layer, values.bis),
    edge: Math.round(254 * EDGE_SHARE),
  };
}

/** Ein Faktor je Quelle: derselbe Wert zweimal zu prüfen hilft niemandem. */
export function replaceFactor(factors: readonly Faktor[], next: Faktor): Faktor[] {
  const spot = factors.findIndex((factor) => factor.source === next.source);
  if (spot < 0) return [...factors, next];
  return factors.map((factor, i) => (i === spot ? next : factor));
}

/**
 * Eine kurze Kennung der Kombination. Sie steht im Ordner der Adresse, damit
 * MapLibre die Kacheln einer alten Kombination nicht weiterbenutzt.
 */
export function combinationKey(parts: readonly string[]): string {
  let hash = 5381;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
