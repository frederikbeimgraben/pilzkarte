/**
 * Der Vertrag der Einordnung, wie ihn `backend/app/modules/taxonomy/schemas.py`
 * festlegt. Eine Tabelle trägt alle Ränge und verkettet sich über den Eltern-
 * eintrag; ein Rang mehr ist darum ein Wert in dieser Liste und sonst nichts.
 */

import type { SpeciesBrief } from './species';

/** Die Stufen der Einordnung, von weit nach eng. */
export const TAXON_RANKS = ['klasse', 'ordnung', 'familie', 'gattung'] as const;
export type TaxonRank = (typeof TAXON_RANKS)[number];

/** Ein Taxon, so knapp wie eine Verweiszeile es braucht. */
export interface TaxonStep {
  rang: TaxonRank;
  slug: string;
  name: string;
  /** Leer, wo keine Quelle einen führt. Dann steht er schon in `name`. */
  lateinisch: string | null;
}

/** Ein Taxon eine Stufe tiefer, mit allen Arten unter ihm gezählt. */
export interface TaxonChild extends TaxonStep {
  artenZahl: number;
}

/**
 * Eine Stufe mit ihren Nachbarn. `pfad` und `geschwister` sind die äußere
 * Einordnung, `kinder` und `arten` die innere. In `arten` stehen nur die Arten,
 * die an genau dieser Stufe hängen; was tiefer hängt, steht in `artenZahl` am
 * Kind.
 */
export interface Taxon extends TaxonStep {
  beschreibung: string | null;
  pfad: TaxonStep[];
  geschwister: TaxonStep[];
  kinder: TaxonChild[];
  arten: SpeciesBrief[];
  artenZahl: number;
}
