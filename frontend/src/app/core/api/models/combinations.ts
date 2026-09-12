/**
 * Die gespeicherten Kombinationen. Vertrag:
 * `backend/app/modules/combinations/schemas.py`.
 */

/** Wie die Karte die Faktoren zusammenrechnet. */
export type Rule = 'schnitt' | 'abgestuft';

/** Die drei Formen einer Bedingung. Alle drei sind eine Spanne der Skala. */
export type Condition = 'unter' | 'ueber' | 'zwischen';

/**
 * Ein Faktor auf dem Draht. Die Bedingung nennt nur die Grenze, die sie
 * braucht: `unter` trägt `bis`, `ueber` trägt `von`, `zwischen` beide. Die
 * andere bleibt leer, weil eine Zahl dort nichts messen würde.
 */
export interface WireFactor {
  quelle: string;
  bedingung: Condition;
  von: number | null;
  bis: number | null;
  aktiv: boolean;
}

export interface Combination {
  id: string;
  name: string;
  regel: Rule;
  faktoren: WireFactor[];
  erstelltAm: string;
  geaendertAm: string;
}

export interface CombinationInput {
  name: string;
  regel: Rule;
  faktoren: WireFactor[];
}
