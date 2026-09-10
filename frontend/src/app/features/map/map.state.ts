import { Injectable, computed, signal } from '@angular/core';
import { FORECAST_SLUGS, type ForecastSlug } from '../../core/tiles/tile-paths';
import { BACKGROUNDS, backgroundAvailable, type Background } from '../../map/background';
import type { CombinationRule } from '../../map/value-colors';
import { DEFAULT_FACTORS, encodeFactors, readFactors, type Faktor } from './factors';
import type { Detent } from '../../ui';

/** Die drei Darstellungen des Blatts. Die Kombination kommt in B2. */
export type ViewMode = 'vorhersage' | 'ebene' | 'kombination';

export const VIEW_MODES: readonly ViewMode[] = ['vorhersage', 'ebene', 'kombination'];

/** Ohne Angabe zeigt die Karte den Steinpilz. */
export const DEFAULT_SPECIES: ForecastSlug = 'boletus_edulis';

/**
 * Ohne Wahl steht der Niederschlag der letzten vier Wochen vorn: die Ebene,
 * nach der man zuerst schaut, und das Beispiel aus dem Konzept.
 */
export const DEFAULT_LAYER = 'regen_4w';

const WEEK_PATTERN = /^\d{4}-\d{2}$/;
const LAYER_PATTERN = /^[a-z0-9_]{1,40}$/;

/** Der Zustand, den ein Link trägt. */
export interface MapAddress {
  art: ForecastSlug;
  kw: string | null;
  viewMode: ViewMode;
  layer: string | null;
  /** Deckkraft der Wertebene in Prozent, damit die Adresse lesbar bleibt. */
  opacity: number;
  rule: CombinationRule;
  /** Die Faktoren in einem Wert, siehe `kodiereFaktoren`. */
  f: string;
}

/** Die drei Arten von Objekt, die ein Blatt über der Karte zeigen kann. */
export const OBJECT_KINDS = ['fund', 'marker', 'zone'] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/** Welches Objekt gerade offen ist. In der Adresse steht `fund:<id>`. */
export interface OpenObject {
  art: ObjectKind;
  id: string;
}

/** Liest `fund:<id>` aus der Adresse. Alles andere zählt als „nichts offen“. */
export function readObject(value: string | null): OpenObject | null {
  if (value === null) return null;
  const splitter = value.indexOf(':');
  const art = value.slice(0, splitter);
  const id = value.slice(splitter + 1);
  if (splitter < 0 || id === '' || !(OBJECT_KINDS as readonly string[]).includes(art)) return null;
  return { art: art as ObjectKind, id };
}

/** Schreibt ein Objekt in die Form, die die Adresse trägt. */
export function writeObject(object: OpenObject): string {
  return `${object.art}:${object.id}`;
}

function isSpecies(value: string | null): value is ForecastSlug {
  return value !== null && (FORECAST_SLUGS as readonly string[]).includes(value);
}

function isView(value: string | null): value is ViewMode {
  return value !== null && (VIEW_MODES as readonly string[]).includes(value);
}

function readPercent(value: string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(Math.max(Math.round(number), 0), 100) / 100;
}

/**
 * Art, Woche, Darstellung, Ebene, Deckkraft und Raste der Karte.
 *
 * Was in der Adresse steht, öffnet ein Link genauso wieder. Ein Wert in
 * falscher Form fällt auf den Standard zurück, statt eine leere Karte zu zeigen.
 */
@Injectable({ providedIn: 'root' })
export class MapState {
  readonly art = signal<ForecastSlug>(DEFAULT_SPECIES);
  /** `2025-40` oder `null` für „die aktuelle Woche der Art“. */
  readonly woche = signal<string | null>(null);
  readonly viewMode = signal<ViewMode>('vorhersage');
  /** Die gewählte Eingabe-Ebene, `null` heißt „die erste der Liste“. */
  readonly layer = signal<string | null>(null);
  /** Deckkraft der Wertebene, 0 bis 1. */
  readonly opacity = signal(1);
  readonly background = signal<Background>('automatisch');
  readonly rule = signal<CombinationRule>('schnitt');
  readonly factors = signal<readonly Faktor[]>(DEFAULT_FACTORS);
  /** In der Darstellung Ebene: die Vorhersage der Art bleibt darunter liegen. */
  readonly forecastBelow = signal(false);
  readonly detent = signal<Detent>(1);

  /**
   * Was außer der Vorhersage auf der Karte liegt. Der Ebenen-Knopf schaltet
   * genau diese drei Signale; die Karte zeichnet, was sie erlauben.
   */
  readonly showMarkers = signal(true);
  readonly showZones = signal(true);
  readonly showSharedFinds = signal(true);

  /** Das Objekt-Blatt über der Karte, aus `?objekt=fund:<id>`. */
  readonly object = signal<OpenObject | null>(null);

  /**
   * Die Höhe des Blatts, das gerade über der Karte liegt (Melden, Objekt), in
   * Punkten. Die Karte rechnet ihr Polster darauf, damit die Mitte unter dem
   * Fadenkreuz liegt und nicht hinter dem Blatt.
   */
  readonly overlayHeight = signal(0);

  readonly adresse = computed<MapAddress>(() => ({
    art: this.art(),
    kw: this.woche(),
    viewMode: this.viewMode(),
    layer: this.layer(),
    opacity: Math.round(this.opacity() * 100),
    rule: this.rule(),
    f: encodeFactors(this.factors()),
  }));

  /** Übernimmt die Abfragewerte einer Adresse. */
  adopt(query: {
    art: string | null;
    kw: string | null;
    viewMode: string | null;
    layer: string | null;
    opacity: string | null;
    rule: string | null;
    f: string | null;
    object: string | null;
  }): void {
    this.art.set(isSpecies(query.art) ? query.art : DEFAULT_SPECIES);
    this.woche.set(query.kw !== null && WEEK_PATTERN.test(query.kw) ? query.kw : null);
    this.viewMode.set(isView(query.viewMode) ? query.viewMode : 'vorhersage');
    this.layer.set(query.layer !== null && LAYER_PATTERN.test(query.layer) ? query.layer : null);
    const opacity = readPercent(query.opacity);
    if (opacity !== null) this.opacity.set(opacity);
    this.rule.set(query.rule === 'abgestuft' ? 'abgestuft' : 'schnitt');
    // Ohne Faktoren in der Adresse bleiben die vier aus dem Konzept stehen;
    // eine leere Kombination hätte nichts zu zeigen.
    const factors = readFactors(query.f);
    this.factors.set(factors.length > 0 ? factors : DEFAULT_FACTORS);
    this.object.set(readObject(query.object));
  }

  setBackground(choice: Background): void {
    if (BACKGROUNDS.includes(choice) && backgroundAvailable(choice)) this.background.set(choice);
  }
}
