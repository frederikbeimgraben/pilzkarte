import { TestBed } from '@angular/core/testing';
import { KarteComponent } from '../features/karte/karte.component';
import { KARTE_ADAPTER, WERT_ARBEITER } from '../map/karte.tokens';
import type { Ausschnitt } from '../map/kachel-raster';
import type { Grenzen, KartenOptionen, MapAdapter, Polster } from '../map/map-adapter';
import type { WertAntwort, WertAuftrag } from '../map/wert-nachrichten';
import type { FaerbeArbeiter } from '../map/wert-protokoll';

/** Eine Karte ohne WebGL. Sie merkt sich, was die Seite von ihr wollte. */
export class KartenAttrappe implements MapAdapter {
  optionen: KartenOptionen | null = null;
  stile: string[] = [];
  vorlagen: string[] = [];
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

  zeigeWert(vorlage: string): void {
    this.vorlagen.push(vorlage);
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

/** Ein Manifest vom Server, ohne Server. */
export function manifestAntwort(daten: unknown = MANIFEST_ROH): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(daten) } as Response),
  );
}

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
    { year: 2025, week: 40, forecast: false, tiles: 'boletus_edulis_kacheln/2025W40', mean: 0.1, max: 0.5 },
    { year: 2025, week: 41, forecast: true, tiles: 'boletus_edulis_kacheln/2025W41', mean: 0.08, max: 0.4 },
  ],
};
