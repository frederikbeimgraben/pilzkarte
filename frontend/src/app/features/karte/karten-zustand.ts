import { Injectable, computed, signal } from '@angular/core';
import { VORHERSAGE_SLUGS, type VorhersageSlug } from '../../core/kacheln/kachel-pfade';
import type { Raste } from '../../ui';

/** Die drei Darstellungen des Blatts. Ebene und Kombination kommen in B1 und B2. */
export type Darstellung = 'vorhersage' | 'ebene' | 'kombination';

export const DARSTELLUNGEN: readonly Darstellung[] = ['vorhersage', 'ebene', 'kombination'];

/** Ohne Angabe zeigt die Karte den Steinpilz. */
export const STANDARD_ART: VorhersageSlug = 'boletus_edulis';

const WOCHEN_MUSTER = /^\d{4}-\d{2}$/;

/** Der Zustand, den ein Link trägt. */
export interface KartenAdresse {
  art: VorhersageSlug;
  kw: string | null;
}

function istArt(wert: string | null): wert is VorhersageSlug {
  return wert !== null && (VORHERSAGE_SLUGS as readonly string[]).includes(wert);
}

function istDarstellung(wert: string | null): wert is Darstellung {
  return wert !== null && (DARSTELLUNGEN as readonly string[]).includes(wert);
}

/**
 * Art, Woche, Darstellung und Raste der Karte.
 *
 * Art und Woche stehen in der Adresse, damit ein Link dieselbe Ansicht öffnet.
 * Eine unbekannte Art oder eine Woche in falscher Form fällt auf den Standard
 * zurück, statt eine leere Karte zu zeigen.
 */
@Injectable({ providedIn: 'root' })
export class KartenZustand {
  readonly art = signal<VorhersageSlug>(STANDARD_ART);
  /** `2025-40` oder `null` für „die aktuelle Woche der Art“. */
  readonly woche = signal<string | null>(null);
  readonly darstellung = signal<Darstellung>('vorhersage');
  readonly raste = signal<Raste>(1);

  readonly adresse = computed<KartenAdresse>(() => ({ art: this.art(), kw: this.woche() }));

  /** Übernimmt die Abfragewerte einer Adresse. */
  uebernimm(art: string | null, kw: string | null, darstellung: string | null = null): void {
    this.art.set(istArt(art) ? art : STANDARD_ART);
    this.woche.set(kw !== null && WOCHEN_MUSTER.test(kw) ? kw : null);
    if (istDarstellung(darstellung)) this.darstellung.set(darstellung);
  }
}
