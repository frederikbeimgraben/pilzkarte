import type { Map as MapLibreKarte } from 'maplibre-gl';
import { geometrieFuer, starteZeichnen, type TerraModul } from './zonen-zeichner';
import type { Ort } from './eintragen.zustand';

const RING: Ort[] = [
  [9.0, 48.5],
  [9.1, 48.5],
  [9.1, 48.6],
];

/** Terra Draw ohne Karte: die Attrappe schreibt mit, was sie bekommen hat. */
class DrawAttrappe {
  static letzte: DrawAttrappe | null = null;
  readonly features: { id: string | number; geometry: { type: string } }[] = [];
  readonly modi: string[] = [];
  gestartet = 0;
  gestoppt = 0;
  geleert = 0;
  gewaehlt: (string | number)[] = [];
  aenderung: (() => void) | null = null;
  schnappschuss: unknown = null;

  constructor() {
    DrawAttrappe.letzte = this;
  }

  start(): void {
    this.gestartet += 1;
  }

  stop(): void {
    this.gestoppt += 1;
  }

  setMode(modus: string): void {
    this.modi.push(modus);
  }

  clear(): void {
    this.geleert += 1;
    this.features.length = 0;
  }

  getFeatureId(): string {
    return `f-${this.features.length + 1}`;
  }

  addFeatures(features: { id: string | number; geometry: { type: string } }[]): void {
    this.features.push(...features);
  }

  selectFeature(id: string | number): void {
    this.gewaehlt.push(id);
  }

  on(_typ: string, hoerer: () => void): void {
    this.aenderung = hoerer;
  }

  getSnapshotFeature(): unknown {
    return this.schnappschuss;
  }
}

/** Die zuletzt gebaute Zeichnung. Ohne sie gäbe es nichts zu prüfen. */
function drawAttrappe(): DrawAttrappe {
  if (DrawAttrappe.letzte === null) throw new Error('Es wurde keine Zeichnung gebaut.');
  return DrawAttrappe.letzte;
}

class ModusAttrappe {
  constructor(readonly optionen: unknown) {}
}

const lader = (): Promise<TerraModul> =>
  Promise.resolve({
    terra: {
      TerraDraw: DrawAttrappe,
      TerraDrawPointMode: ModusAttrappe,
      TerraDrawLineStringMode: ModusAttrappe,
      TerraDrawPolygonMode: ModusAttrappe,
      TerraDrawSelectMode: ModusAttrappe,
    },
    adapter: { TerraDrawMapLibreGLAdapter: ModusAttrappe },
  } as unknown as TerraModul);

function karte(): MapLibreKarte {
  return {} as MapLibreKarte;
}

describe('geometrieFuer', () => {
  it('macht aus einem Punkt einen Punkt, aus zwei eine Linie, aus dreien eine Fläche', () => {
    expect(geometrieFuer([])).toBeNull();
    expect(geometrieFuer(RING.slice(0, 1))?.modus).toBe('point');
    expect(geometrieFuer(RING.slice(0, 2))?.modus).toBe('linestring');
    const flaeche = geometrieFuer(RING);
    expect(flaeche?.modus).toBe('polygon');
    expect((flaeche?.geometrie as { coordinates: number[][][] }).coordinates[0]).toHaveLength(4);
  });
});

describe('starteZeichnen', () => {
  it('startet im Auswahlmodus, damit ein Tipp nichts zeichnet', async () => {
    await starteZeichnen(karte(), '#004225', lader);

    expect(DrawAttrappe.letzte?.gestartet).toBe(1);
    expect(DrawAttrappe.letzte?.modi).toEqual(['select']);
  });

  it('legt den Ring als Feature auf die Karte und räumt den alten weg', async () => {
    const sitzung = await starteZeichnen(karte(), '#004225', lader);

    sitzung.zeigeRing(RING);

    expect(DrawAttrappe.letzte?.features[0].geometry.type).toBe('Polygon');
    expect(DrawAttrappe.letzte?.geleert).toBe(1);
  });

  it('legt nichts auf, solange kein Eckpunkt steht', async () => {
    const sitzung = await starteZeichnen(karte(), '#004225', lader);

    sitzung.zeigeRing([]);

    expect(DrawAttrappe.letzte?.features).toHaveLength(0);
  });

  it('meldet den verschobenen Ring ohne den doppelten Endpunkt', async () => {
    const sitzung = await starteZeichnen(karte(), '#004225', lader);
    sitzung.zeigeRing(RING);
    const gezogen: Ort[][] = [];
    sitzung.bearbeiten((ring) => gezogen.push(ring));
    const draw = drawAttrappe();
    draw.schnappschuss = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9, 48.5],
            [9.2, 48.5],
            [9.2, 48.7],
            [9, 48.5],
          ],
        ],
      },
    };

    draw.aenderung?.();

    expect(gezogen[0]).toEqual([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
  });

  it('meldet nichts, wenn der Schnappschuss keine Fläche ist', async () => {
    const sitzung = await starteZeichnen(karte(), '#004225', lader);
    sitzung.zeigeRing(RING);
    const gezogen: Ort[][] = [];
    sitzung.bearbeiten((ring) => gezogen.push(ring));
    const draw = drawAttrappe();
    draw.schnappschuss = { geometry: { type: 'Point', coordinates: [9, 48] } };

    draw.aenderung?.();

    expect(gezogen).toHaveLength(0);
  });

  it('lässt nichts auswählen, solange kein Ring liegt', async () => {
    const sitzung = await starteZeichnen(karte(), '#004225', lader);

    sitzung.bearbeiten(() => undefined);

    expect(DrawAttrappe.letzte?.gewaehlt).toEqual([]);
  });

  it('räumt beim Beenden auf', async () => {
    const sitzung = await starteZeichnen(karte(), '#004225', lader);

    sitzung.beende();

    expect(DrawAttrappe.letzte?.gestoppt).toBe(1);
  });
});
