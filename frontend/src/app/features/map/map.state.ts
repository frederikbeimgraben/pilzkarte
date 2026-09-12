import { Injectable, effect, signal } from '@angular/core';
import { FORECAST_SLUGS, type ForecastSlug } from '../../core/tiles/tile-paths';
import { BACKGROUNDS, backgroundAvailable, type Background } from '../../map/background';
import type { CombinationRule } from '../../map/value-colors';
import { encodeFactors, readFactors, type Faktor } from './factors';
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

/**
 * Der Schlüssel im Speicher des Geräts. Die Zahl steht dahinter, damit eine
 * spätere Form die alte nicht falsch liest, sondern verwirft.
 */
export const STORAGE_KEY = 'pilzkarte.karte.v1';

/** So lange wird gewartet, bevor eine Änderung im Speicher landet. */
export const SAVE_DELAY = 400;

/** Was ein Link beim ersten Laden mitbringen darf. */
export interface MapQuery {
  art: string | null;
  kw: string | null;
  viewMode: string | null;
  layer: string | null;
  opacity: string | null;
  rule: string | null;
  f: string | null;
  object: string | null;
}

/** Der Zustand, wie er im Speicher liegt. Jedes Feld darf fehlen. */
interface Saved {
  art?: unknown;
  woche?: unknown;
  viewMode?: unknown;
  layer?: unknown;
  opacity?: unknown;
  rule?: unknown;
  factors?: unknown;
  background?: unknown;
  forecastBelow?: unknown;
  showMarkers?: unknown;
  showZones?: unknown;
  showSharedFinds?: unknown;
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
 * Art, Woche, Darstellung, Ebene, Deckkraft, Regel und Faktoren der Karte.
 *
 * Dieser Dienst ist die einzige Quelle. Die Karte liest ihn, nie die Adresse:
 * Adresse und Zustand gegeneinander zu schreiben war die Ursache dafür, dass
 * ein Reiterwechsel die Art zurücksetzte.
 *
 * Der Zustand überlebt ein Neuladen im Speicher des Geräts. Ein Link darf ihn
 * einmal beim Eintritt setzen; danach ändert Navigation ihn nicht mehr.
 */
@Injectable({ providedIn: 'root' })
export class MapState {
  readonly art = signal<ForecastSlug>(DEFAULT_SPECIES);
  /**
   * Ob das Ebenen-Blatt offen ist. Es hängt hier und nicht an der Kartenseite,
   * weil der Knopf dazu am Rechner auch auf den anderen Reitern steht.
   */
  readonly layersSheetOpen = signal(false);
  /** `2025-40` oder `null` für „die aktuelle Woche der Art“. */
  readonly woche = signal<string | null>(null);
  readonly viewMode = signal<ViewMode>('vorhersage');
  /** Die gewählte Eingabe-Ebene, `null` heißt „die erste der Liste“. */
  readonly layer = signal<string | null>(null);
  /** Deckkraft der Wertebene, 0 bis 1. */
  readonly opacity = signal(1);
  readonly background = signal<Background>('automatisch');
  readonly rule = signal<CombinationRule>('schnitt');
  readonly factors = signal<readonly Faktor[]>([]);
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

  private schreiber: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    // Gedrosselt: beim Ziehen eines Reglers ändern sich Signale im Takt der
    // Finger, und jeder Schreibvorgang ginge synchron auf die Platte.
    effect(() => {
      const stand = this.alsGesichert();
      if (this.schreiber !== null) clearTimeout(this.schreiber);
      this.schreiber = setTimeout(() => {
        this.sichere(stand);
      }, SAVE_DELAY);
    });
  }

  /**
   * Übernimmt die Werte eines Links. Nur beim Eintritt: danach führt der
   * Zustand, und die Adresse wird wieder sauber gemacht.
   */
  adopt(query: MapQuery): void {
    if (isSpecies(query.art)) this.art.set(query.art);
    if (query.kw !== null && WEEK_PATTERN.test(query.kw)) this.woche.set(query.kw);
    if (isView(query.viewMode)) this.viewMode.set(query.viewMode);
    if (query.layer !== null && LAYER_PATTERN.test(query.layer)) this.layer.set(query.layer);
    const opacity = readPercent(query.opacity);
    if (opacity !== null) this.opacity.set(opacity);
    if (query.rule === 'abgestuft' || query.rule === 'schnitt') this.rule.set(query.rule);
    if (query.f !== null) this.factors.set(readFactors(query.f));
    if (query.object !== null) this.object.set(readObject(query.object));
  }

  /** Trägt der Link überhaupt etwas? Sonst bleibt der gesicherte Stand. */
  static hasValues(query: MapQuery): boolean {
    return Object.values(query).some((value) => value !== null);
  }

  /** Nimmt nur an, was es gibt; ein fremder Wert aus dem Speicher fällt weg. */
  setBackground(choice: string): void {
    const gefunden = BACKGROUNDS.find((entry) => entry === choice);
    if (gefunden && backgroundAvailable(gefunden)) this.background.set(gefunden);
  }

  private alsGesichert(): Saved {
    return {
      art: this.art(),
      woche: this.woche(),
      viewMode: this.viewMode(),
      layer: this.layer(),
      opacity: this.opacity(),
      rule: this.rule(),
      factors: encodeFactors(this.factors()),
      background: this.background(),
      forecastBelow: this.forecastBelow(),
      showMarkers: this.showMarkers(),
      showZones: this.showZones(),
      showSharedFinds: this.showSharedFinds(),
    };
  }

  private sichere(stand: Saved): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stand));
    } catch {
      // Ein gesperrter oder voller Speicher ist kein Fehler; dann gilt der
      // Zustand eben nur für diese Sitzung.
    }
  }

  /** Ein Wert in falscher Form wird verworfen, nicht übernommen. */
  private load(): void {
    let stand: Saved = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const got: Saved | null = JSON.parse(raw) as Saved | null;
      if (typeof got !== 'object' || got === null) return;
      stand = got;
    } catch {
      return;
    }
    if (typeof stand.art === 'string' && isSpecies(stand.art)) this.art.set(stand.art);
    if (typeof stand.woche === 'string' && WEEK_PATTERN.test(stand.woche)) this.woche.set(stand.woche);
    if (typeof stand.viewMode === 'string' && isView(stand.viewMode)) {
      this.viewMode.set(stand.viewMode);
    }
    if (typeof stand.layer === 'string' && LAYER_PATTERN.test(stand.layer)) this.layer.set(stand.layer);
    if (typeof stand.opacity === 'number' && Number.isFinite(stand.opacity)) {
      this.opacity.set(Math.min(Math.max(stand.opacity, 0), 1));
    }
    if (stand.rule === 'abgestuft' || stand.rule === 'schnitt') this.rule.set(stand.rule);
    if (typeof stand.factors === 'string') this.factors.set(readFactors(stand.factors));
    if (typeof stand.background === 'string') this.setBackground(stand.background);
    if (typeof stand.forecastBelow === 'boolean') {
      this.forecastBelow.set(stand.forecastBelow);
    }
    if (typeof stand.showMarkers === 'boolean') this.showMarkers.set(stand.showMarkers);
    if (typeof stand.showZones === 'boolean') this.showZones.set(stand.showZones);
    if (typeof stand.showSharedFinds === 'boolean') {
      this.showSharedFinds.set(stand.showSharedFinds);
    }
  }
}
