import type { CombinationBound, CombinationRule, ValueScale } from './value-colors';

/** Was der Hauptfaden dem Färbe-Worker schickt und was zurückkommt. */

export interface ColorizeJob {
  kind: 'faerbe';
  id: number;
  url: string;
  /** Wie das Byte zu lesen ist: Vorhersage einer Art oder Spanne einer Ebene. */
  scale: ValueScale;
  colors: readonly string[];
}

/** Ein Faktor der Kombination an dieser Kachel. */
export interface CombinationPart {
  url: string;
  bound: CombinationBound;
}

export interface CombinationJob {
  kind: 'kombi';
  id: number;
  parts: readonly CombinationPart[];
  rule: CombinationRule;
  colors: readonly string[];
}

export interface PrefetchJob {
  kind: 'vorladen';
  urls: readonly string[];
}

export type ValueJob = ColorizeJob | CombinationJob | PrefetchJob;

/** `bild` ist `null`, wenn es die Kachel nicht gibt. Das ist kein Fehler. */
export interface ValueReply {
  id: number;
  shot: ImageBitmap | null;
}
