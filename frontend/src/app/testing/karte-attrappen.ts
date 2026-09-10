import { TestBed } from '@angular/core/testing';
import { KarteComponent } from '../features/karte/karte.component';
import { KARTE_ADAPTER, WERT_ARBEITER } from '../map/karte.tokens';
import type { Ausschnitt } from '../map/kachel-raster';
import type { Grenzen, KartenOptionen, MapAdapter, Polster, Rolle } from '../map/map-adapter';
import type { WertAntwort, WertAuftrag } from '../map/wert-nachrichten';
import type { FaerbeArbeiter } from '../map/wert-protokoll';

/** Eine Karte ohne WebGL. Sie merkt sich, was die Seite von ihr wollte. */
export class KartenAttrappe implements MapAdapter {
  optionen: KartenOptionen | null = null;
  stile: string[] = [];
  /** Je Rolle, was zuletzt gefragt wurde. `null` heißt „abgeräumt“. */
  readonly vorlagenJeRolle = new Map<Rolle, (string | null)[]>();
  readonly deckkraft = new Map<Rolle, number>();
  zentriert: { punkt: readonly [number, number]; zoom: number } | null = null;
  polster: Polster[] = [];
  eingepasst: { grenzen: Grenzen; polster: Polster }[] = [];
  bewegung: (() => void) | null = null;
  zerstoert = false;
  sicht: { zoom: number; ausschnitt: Ausschnitt } | null = {
    zoom: 7,
    ausschnitt: { west: 9.9, sued: 50.9, ost: 10.9, nord: 51.9 },
  };

  gewaermt = 0;

  waermeAuf(): void {
    this.gewaermt += 1;
  }

  starte(_wirt: HTMLElement, optionen: KartenOptionen): Promise<void> {
    this.optionen = optionen;
    return Promise.resolve();
  }

  setzeStil(stil: string): void {
    this.stile.push(stil);
  }

  zeigeWert(rolle: Rolle, vorlage: string | null): void {
    const bisher = this.vorlagenJeRolle.get(rolle) ?? [];
    bisher.push(vorlage);
    this.vorlagenJeRolle.set(rolle, bisher);
  }

  setzeDeckkraft(rolle: Rolle, wert: number): void {
    this.deckkraft.set(rolle, wert);
  }

  zentriere(punkt: readonly [number, number], zoom: number): void {
    this.zentriert = { punkt, zoom };
  }

  /** Was für eine Rolle gefragt wurde, ohne die Abräum-Aufrufe. */
  vorlagen(rolle: Rolle = 'vorhersage'): string[] {
    return (this.vorlagenJeRolle.get(rolle) ?? []).filter((wert): wert is string => wert !== null);
  }

  passeEin(grenzen: Grenzen, polster: Polster): void {
    this.eingepasst.push({ grenzen, polster });
  }

  setzePolster(polster: Polster): void {
    this.polster.push(polster);
  }

  ausschnitt(): { zoom: number; ausschnitt: Ausschnitt } | null {
    return this.sicht;
  }

  beiBewegung(hoerer: () => void): void {
    this.bewegung = hoerer;
  }

  zerstoere(): void {
    this.zerstoert = true;
  }
}

/** Ein Worker, der nichts färbt. Der Test antwortet selbst über `antworte`. */
export class ArbeiterAttrappe implements FaerbeArbeiter {
  readonly auftraege: WertAuftrag[] = [];
  beendet = false;
  private hoerer: ((ereignis: MessageEvent<WertAntwort>) => void) | null = null;

  postMessage(auftrag: WertAuftrag): void {
    this.auftraege.push(auftrag);
  }

  addEventListener(_typ: 'message', hoerer: (ereignis: MessageEvent<WertAntwort>) => void): void {
    this.hoerer = hoerer;
  }

  terminate(): void {
    this.beendet = true;
  }

  antworte(antwort: WertAntwort): void {
    this.hoerer?.({ data: antwort } as MessageEvent<WertAntwort>);
  }
}

/**
 * Hängt der Kartenseite Attrappen statt MapLibre und Worker unter. Muss vor
 * dem ersten `render` laufen, sonst steht die echte Karte schon.
 */
export function karteMitAttrappen(): { karte: KartenAttrappe; arbeiter: ArbeiterAttrappe } {
  const karte = new KartenAttrappe();
  const arbeiter = new ArbeiterAttrappe();
  TestBed.overrideComponent(KarteComponent, {
    add: {
      providers: [
        { provide: KARTE_ADAPTER, useValue: karte },
        { provide: WERT_ARBEITER, useValue: () => arbeiter },
      ],
    },
  });
  return { karte, arbeiter };
}

/** Die Manifeste vom Server, ohne Server. */
export function manifestAntwort(daten: unknown = MANIFEST_ROH, ebenen: unknown = EBENEN_ROH): void {
  vi.stubGlobal('fetch', (pfad: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(pfad === '/layers.json' ? ebenen : daten),
    } as Response),
  );
}

/** Zwei Wochenebenen und zwei feste, wie sie `input_layers.py` schreibt. */
export const EBENEN_ROH = {
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  layers: {
    regen_4w: {
      label: 'Niederschlag der letzten 4 Wochen',
      unit: 'mm',
      static: false,
      low: 0,
      high: 151.9,
      weeks: ['2025W39', '2025W40'],
      tiles: 'layers_kacheln/regen_4w',
      zooms: [5, 7],
      have: { '7': ['66/42', '67/42'] },
      histogramme: {
        '2025W39': { klassen: [0, 50, 100, 151.9], anteile: [0.5, 0.3, 0.2] },
        '2025W40': { klassen: [0, 50, 100, 151.9], anteile: [0.6, 0.3, 0.1] },
      },
    },
    temperatur: {
      label: 'Mitteltemperatur der Woche',
      unit: 'Grad',
      static: false,
      low: -3.6,
      high: 24.7,
      weeks: ['2025W39', '2025W40'],
      tiles: 'layers_kacheln/temperatur',
      zooms: [5, 7],
      have: { '7': ['66/42'] },
    },
    wald: {
      label: 'Waldanteil',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/wald',
      zooms: [5, 8],
      have: { '7': ['66/42'] },
      histogramm: { klassen: [0, 0.5, 1], anteile: [0.7, 0.3] },
    },
    boden_ph: {
      label: 'Boden-pH',
      unit: '',
      static: true,
      low: 4.663,
      high: 6.899,
      tiles: 'layers_kacheln/boden_ph',
      zooms: [5, 8],
      have: { '7': ['66/42'] },
    },
  },
};

/** Zwei gemessene Wochen und eine Prognose, wie sie das Rendering schreibt. */
export const MANIFEST_ROH = {
  name: 'boletus_edulis',
  species: ['Boletus edulis'],
  top: 0.5,
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  tiles: { zooms: [5, 8], have: { '7': ['66/42', '67/42'] } },
  weeks: [
    { year: 2025, week: 39, forecast: false, tiles: 'boletus_edulis_kacheln/2025W39', mean: 0.05, max: 0.3 },
    {
      year: 2025,
      week: 40,
      forecast: false,
      tiles: 'boletus_edulis_kacheln/2025W40',
      mean: 0.1,
      max: 0.5,
      histogramm: { klassen: [0, 0.25, 0.5], anteile: [0.8, 0.2] },
    },
    { year: 2025, week: 41, forecast: true, tiles: 'boletus_edulis_kacheln/2025W41', mean: 0.08, max: 0.4 },
  ],
};
