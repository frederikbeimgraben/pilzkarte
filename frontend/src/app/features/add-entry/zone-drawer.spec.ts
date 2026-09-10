import type { Map as MapLibreMap } from 'maplibre-gl';
import { geometryFor, startDrawing, type TerraModule } from './zone-drawer';
import type { Location } from './add-entry.state';

const RING: Location[] = [
  [9.0, 48.5],
  [9.1, 48.5],
  [9.1, 48.6],
];

/** Terra Draw ohne Karte: die Attrappe schreibt mit, was sie bekommen hat. */
class DrawDouble {
  static last: DrawDouble | null = null;
  readonly features: { id: string | number; geometry: { type: string } }[] = [];
  readonly modi: string[] = [];
  started = 0;
  stopped = 0;
  cleared = 0;
  selected: (string | number)[] = [];
  patch: (() => void) | null = null;
  snapshot: unknown = null;

  constructor() {
    DrawDouble.last = this;
  }

  start(): void {
    this.started += 1;
  }

  stop(): void {
    this.stopped += 1;
  }

  setMode(mode: string): void {
    this.modi.push(mode);
  }

  clear(): void {
    this.cleared += 1;
    this.features.length = 0;
  }

  getFeatureId(): string {
    return `f-${this.features.length + 1}`;
  }

  addFeatures(features: { id: string | number; geometry: { type: string } }[]): void {
    this.features.push(...features);
  }

  selectFeature(id: string | number): void {
    this.selected.push(id);
  }

  on(_kind: string, handler: () => void): void {
    this.patch = handler;
  }

  getSnapshotFeature(): unknown {
    return this.snapshot;
  }
}

/** Die zuletzt gebaute Zeichnung. Ohne sie gäbe es nichts zu prüfen. */
function drawDouble(): DrawDouble {
  if (DrawDouble.last === null) throw new Error('Es wurde keine Zeichnung gebaut.');
  return DrawDouble.last;
}

class ModeDouble {
  constructor(readonly options: unknown) {}
}

const loader = (): Promise<TerraModule> =>
  Promise.resolve({
    terra: {
      TerraDraw: DrawDouble,
      TerraDrawPointMode: ModeDouble,
      TerraDrawLineStringMode: ModeDouble,
      TerraDrawPolygonMode: ModeDouble,
      TerraDrawSelectMode: ModeDouble,
    },
    adapter: { TerraDrawMapLibreGLAdapter: ModeDouble },
  } as unknown as TerraModule);

function map(): MapLibreMap {
  return {} as MapLibreMap;
}

describe('geometrieFuer', () => {
  it('macht aus einem Punkt einen Punkt, aus zwei eine Linie, aus dreien eine Fläche', () => {
    expect(geometryFor([])).toBeNull();
    expect(geometryFor(RING.slice(0, 1))?.mode).toBe('point');
    expect(geometryFor(RING.slice(0, 2))?.mode).toBe('linestring');
    const surface = geometryFor(RING);
    expect(surface?.mode).toBe('polygon');
    expect((surface?.geometry as { coordinates: number[][][] }).coordinates[0]).toHaveLength(4);
  });
});

describe('starteZeichnen', () => {
  it('startet im Auswahlmodus, damit ein Tipp nichts zeichnet', async () => {
    await startDrawing(map(), '#004225', loader);

    expect(DrawDouble.last?.started).toBe(1);
    expect(DrawDouble.last?.modi).toEqual(['select']);
  });

  it('legt den Ring als Feature auf die Karte und räumt den alten weg', async () => {
    const session = await startDrawing(map(), '#004225', loader);

    session.showRing(RING);

    expect(DrawDouble.last?.features[0].geometry.type).toBe('Polygon');
    expect(DrawDouble.last?.cleared).toBe(1);
  });

  it('legt nichts auf, solange kein Eckpunkt steht', async () => {
    const session = await startDrawing(map(), '#004225', loader);

    session.showRing([]);

    expect(DrawDouble.last?.features).toHaveLength(0);
  });

  it('meldet den verschobenen Ring ohne den doppelten Endpunkt', async () => {
    const session = await startDrawing(map(), '#004225', loader);
    session.showRing(RING);
    const dragged: Location[][] = [];
    session.edit((ring) => dragged.push(ring));
    const draw = drawDouble();
    draw.snapshot = {
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

    draw.patch?.();

    expect(dragged[0]).toEqual([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
  });

  it('meldet nichts, wenn der Schnappschuss keine Fläche ist', async () => {
    const session = await startDrawing(map(), '#004225', loader);
    session.showRing(RING);
    const dragged: Location[][] = [];
    session.edit((ring) => dragged.push(ring));
    const draw = drawDouble();
    draw.snapshot = { geometry: { type: 'Point', coordinates: [9, 48] } };

    draw.patch?.();

    expect(dragged).toHaveLength(0);
  });

  it('lässt nichts auswählen, solange kein Ring liegt', async () => {
    const session = await startDrawing(map(), '#004225', loader);

    session.edit(() => undefined);

    expect(DrawDouble.last?.selected).toEqual([]);
  });

  it('räumt beim Beenden auf', async () => {
    const session = await startDrawing(map(), '#004225', loader);

    session.stop();

    expect(DrawDouble.last?.stopped).toBe(1);
  });
});
