import { Injectable, computed, signal } from '@angular/core';
import { VORHERSAGE_SLUGS, type VorhersageSlug } from '../../core/kacheln/kachel-pfade';
import { HINTERGRUENDE, hintergrundVerfuegbar, type Hintergrund } from '../../map/hintergrund';
import type { KombiRegel } from '../../map/wert-farben';
import { STANDARD_FAKTOREN, kodiereFaktoren, leseFaktoren, type Faktor } from './faktoren';
import type { Raste } from '../../ui';

/** Die drei Darstellungen des Blatts. Die Kombination kommt in B2. */
export type Darstellung = 'vorhersage' | 'ebene' | 'kombination';

export const DARSTELLUNGEN: readonly Darstellung[] = ['vorhersage', 'ebene', 'kombination'];

/** Ohne Angabe zeigt die Karte den Steinpilz. */
export const STANDARD_ART: VorhersageSlug = 'boletus_edulis';

/**
 * Ohne Wahl steht der Niederschlag der letzten vier Wochen vorn: die Ebene,
 * nach der man zuerst schaut, und das Beispiel aus dem Konzept.
 */
export const STANDARD_EBENE = 'regen_4w';

const WOCHEN_MUSTER = /^\d{4}-\d{2}$/;
const EBENEN_MUSTER = /^[a-z0-9_]{1,40}$/;

/** Der Zustand, den ein Link trägt. */
export interface KartenAdresse {
  art: VorhersageSlug;
  kw: string | null;
  darstellung: Darstellung;
  ebene: string | null;
  /** Deckkraft der Wertebene in Prozent, damit die Adresse lesbar bleibt. */
  deckkraft: number;
  regel: KombiRegel;
  /** Die Faktoren in einem Wert, siehe `kodiereFaktoren`. */
  f: string;
}

/** Die drei Arten von Objekt, die ein Blatt über der Karte zeigen kann. */
export const OBJEKT_ARTEN = ['fund', 'marker', 'zone'] as const;
export type ObjektArt = (typeof OBJEKT_ARTEN)[number];

/** Welches Objekt gerade offen ist. In der Adresse steht `fund:<id>`. */
export interface OffenesObjekt {
  art: ObjektArt;
  id: string;
}

/** Liest `fund:<id>` aus der Adresse. Alles andere zählt als „nichts offen“. */
export function leseObjekt(wert: string | null): OffenesObjekt | null {
  if (wert === null) return null;
  const teiler = wert.indexOf(':');
  const art = wert.slice(0, teiler);
  const id = wert.slice(teiler + 1);
  if (teiler < 0 || id === '' || !(OBJEKT_ARTEN as readonly string[]).includes(art)) return null;
  return { art: art as ObjektArt, id };
}

/** Schreibt ein Objekt in die Form, die die Adresse trägt. */
export function schreibeObjekt(objekt: OffenesObjekt): string {
  return `${objekt.art}:${objekt.id}`;
}

function istArt(wert: string | null): wert is VorhersageSlug {
  return wert !== null && (VORHERSAGE_SLUGS as readonly string[]).includes(wert);
}

function istDarstellung(wert: string | null): wert is Darstellung {
  return wert !== null && (DARSTELLUNGEN as readonly string[]).includes(wert);
}

function leseProzent(wert: string | null): number | null {
  if (wert === null) return null;
  const zahl = Number(wert);
  if (!Number.isFinite(zahl)) return null;
  return Math.min(Math.max(Math.round(zahl), 0), 100) / 100;
}

/**
 * Art, Woche, Darstellung, Ebene, Deckkraft und Raste der Karte.
 *
 * Was in der Adresse steht, öffnet ein Link genauso wieder. Ein Wert in
 * falscher Form fällt auf den Standard zurück, statt eine leere Karte zu zeigen.
 */
@Injectable({ providedIn: 'root' })
export class KartenZustand {
  readonly art = signal<VorhersageSlug>(STANDARD_ART);
  /** `2025-40` oder `null` für „die aktuelle Woche der Art“. */
  readonly woche = signal<string | null>(null);
  readonly darstellung = signal<Darstellung>('vorhersage');
  /** Die gewählte Eingabe-Ebene, `null` heißt „die erste der Liste“. */
  readonly ebene = signal<string | null>(null);
  /** Deckkraft der Wertebene, 0 bis 1. */
  readonly deckkraft = signal(1);
  readonly hintergrund = signal<Hintergrund>('automatisch');
  readonly regel = signal<KombiRegel>('schnitt');
  readonly faktoren = signal<readonly Faktor[]>(STANDARD_FAKTOREN);
  /** In der Darstellung Ebene: die Vorhersage der Art bleibt darunter liegen. */
  readonly vorhersageDarunter = signal(false);
  readonly raste = signal<Raste>(1);

  /**
   * Was außer der Vorhersage auf der Karte liegt. Der Ebenen-Knopf schaltet
   * genau diese drei Signale; die Karte zeichnet, was sie erlauben.
   */
  readonly zeigeMarker = signal(true);
  readonly zeigeZonen = signal(true);
  readonly zeigeGeteilteFunde = signal(true);

  /** Das Objekt-Blatt über der Karte, aus `?objekt=fund:<id>`. */
  readonly objekt = signal<OffenesObjekt | null>(null);

  /**
   * Die Höhe des Blatts, das gerade über der Karte liegt (Melden, Objekt), in
   * Punkten. Die Karte rechnet ihr Polster darauf, damit die Mitte unter dem
   * Fadenkreuz liegt und nicht hinter dem Blatt.
   */
  readonly ueberlagerung = signal(0);

  readonly adresse = computed<KartenAdresse>(() => ({
    art: this.art(),
    kw: this.woche(),
    darstellung: this.darstellung(),
    ebene: this.ebene(),
    deckkraft: Math.round(this.deckkraft() * 100),
    regel: this.regel(),
    f: kodiereFaktoren(this.faktoren()),
  }));

  /** Übernimmt die Abfragewerte einer Adresse. */
  uebernimm(abfrage: {
    art: string | null;
    kw: string | null;
    darstellung: string | null;
    ebene: string | null;
    deckkraft: string | null;
    regel: string | null;
    f: string | null;
    objekt: string | null;
  }): void {
    this.art.set(istArt(abfrage.art) ? abfrage.art : STANDARD_ART);
    this.woche.set(abfrage.kw !== null && WOCHEN_MUSTER.test(abfrage.kw) ? abfrage.kw : null);
    this.darstellung.set(istDarstellung(abfrage.darstellung) ? abfrage.darstellung : 'vorhersage');
    this.ebene.set(abfrage.ebene !== null && EBENEN_MUSTER.test(abfrage.ebene) ? abfrage.ebene : null);
    const deckkraft = leseProzent(abfrage.deckkraft);
    if (deckkraft !== null) this.deckkraft.set(deckkraft);
    this.regel.set(abfrage.regel === 'abgestuft' ? 'abgestuft' : 'schnitt');
    // Ohne Faktoren in der Adresse bleiben die vier aus dem Konzept stehen;
    // eine leere Kombination hätte nichts zu zeigen.
    const faktoren = leseFaktoren(abfrage.f);
    this.faktoren.set(faktoren.length > 0 ? faktoren : STANDARD_FAKTOREN);
    this.objekt.set(leseObjekt(abfrage.objekt));
  }

  setzeHintergrund(wahl: Hintergrund): void {
    if (HINTERGRUENDE.includes(wahl) && hintergrundVerfuegbar(wahl)) this.hintergrund.set(wahl);
  }
}
