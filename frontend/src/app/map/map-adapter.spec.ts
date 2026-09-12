import type { FeatureCollection } from 'geojson';
import { MapLibreAdapter, WORKER_PATH, type MapOptions, type MaplibreModule } from './map-adapter';

interface Handler {
  kind: string;
  handler: (payload: unknown) => void;
}

/** Eine MapLibre-Karte ohne WebGL, so weit der Adapter sie anfasst. */
class MapDouble {
  static last: MapDouble | null = null;
  readonly sources = new Map<string, object>();
  readonly layers = new Map<string, object>();
  readonly opacity = new Map<string, number>();
  readonly handler: Handler[] = [];
  onceHandlers = new Map<string, () => void>();
  styles: string[] = [];
  fitted: unknown[] = [];
  moved: unknown[] = [];
  removed = false;
  sourceReady = true;

  constructor(readonly options: Record<string, unknown>) {
    MapDouble.last = this;
  }

  setStyle(style: string): void {
    this.styles.push(style);
  }

  controls: { control: unknown; location: string }[] = [];

  once(kind: string, handler: () => void): void {
    this.onceHandlers.set(kind, handler);
    // Die echte Karte meldet `style.load`, sobald der Stil steht.
    if (kind === 'style.load' && !this.styles.length) handler();
  }

  addControl(control: unknown, location: string): void {
    this.controls.push({ control, location });
  }

  /** Die zweite Form meldet auf eine Schicht an und gibt ein Abo zurück. */
  on(kind: string, second: unknown, third?: (payload: unknown) => void): { unsubscribe: () => void } {
    const handler = (third ?? second) as (payload: unknown) => void;
    const paintLayer = third ? (second as string) : null;
    const entry = { kind: paintLayer === null ? kind : `${kind}:${paintLayer}`, handler };
    this.handler.push(entry);
    return {
      unsubscribe: () => {
        const index = this.handler.indexOf(entry);
        if (index >= 0) this.handler.splice(index, 1);
      },
    };
  }

  /** Stellt einen Tipp auf eine Schicht nach. */
  tap(paintLayer: string, id: string): void {
    for (const entry of [...this.handler]) {
      if (entry.kind === `click:${paintLayer}`) entry.handler({ features: [{ properties: { id } }] });
    }
  }

  off(kind: string, handler: (payload: unknown) => void): void {
    const index = this.handler.findIndex((e) => e.kind === kind && e.handler === handler);
    if (index >= 0) this.handler.splice(index, 1);
  }

  settle(kind: string, source = 'wert-vorhersage-a'): void {
    const payload = { sourceId: source, sourceDataType: 'content', isSourceLoaded: this.sourceReady };
    for (const entry of [...this.handler]) if (entry.kind === kind) entry.handler(payload);
  }

  addSource(id: string, source: { type?: string; data?: unknown }): void {
    // Eine GeoJSON-Quelle nimmt später neue Daten an; eine Rasterquelle nicht.
    const saved: { data?: unknown; setData?: (data: unknown) => Promise<void> } = { ...source };
    if (source.type === 'geojson') {
      saved.setData = (data: unknown) => {
        saved.data = data;
        return Promise.resolve();
      };
    }
    this.sources.set(id, saved);
  }

  readonly placedBefore = new Map<string, string | undefined>();

  addLayer(layer: { id: string; paint: Record<string, number> }, vor?: string): void {
    this.layers.set(layer.id, layer);
    this.opacity.set(layer.id, layer.paint['raster-opacity']);
    this.placedBefore.set(layer.id, vor);
  }

  getSource(id: string): object | undefined {
    return this.sources.get(id);
  }

  getLayer(id: string): object | undefined {
    return this.layers.get(id);
  }

  removeLayer(id: string): void {
    this.layers.delete(id);
  }

  removeSource(id: string): void {
    this.sources.delete(id);
  }

  setPaintProperty(id: string, _name: string, value: number): void {
    this.opacity.set(id, value);
  }

  isSourceLoaded(): boolean {
    return this.sourceReady;
  }

  padding: unknown[] = [];

  setPadding(padding: unknown): void {
    this.padding.push(padding);
  }

  fitBounds(bounds: unknown, options: unknown): void {
    this.fitted.push({ bounds, options });
  }

  easeTo(options: unknown): void {
    this.moved.push(options);
  }

  getCenter(): { lng: number; lat: number } {
    return { lng: 9.05, lat: 48.52 };
  }

  getBounds(): Record<string, () => number> {
    return { getWest: () => 9, getSouth: () => 50, getEast: () => 11, getNorth: () => 52 };
  }

  getZoom(): number {
    return 7;
  }

  remove(): void {
    this.removed = true;
  }
}

/** Der Urheberhinweis; der Adapter fragt ihn nichts, er setzt ihn nur. */
class AttributionDouble {
  constructor(readonly options: unknown) {}
}

/** Eine Sammlung mit genau einem Punkt, so wie die Karte sie bekommt. */
function collection(id: string): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        id,
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [9.05, 48.52] },
        properties: { id, farbe: '#004225', gerundet: true },
      },
    ],
  };
}

const OPTIONEN: MapOptions = {
  style: 'hell',
  centerPoint: [10.4, 51.2],
  zoom: 5,
  minZoom: 5,
  maxZoom: 14,
  maxBounds: [
    [4, 46],
    [16, 56],
  ],
  protocol: { name: 'wert', resolve: () => Promise.resolve({ data: new ArrayBuffer(0) }) },
  compact: false,
};

function module(): {
  module: MaplibreModule;
  signedIn: string[];
  signedOut: string[];
  worker: string[];
} {
  const signedIn: string[] = [];
  const signedOut: string[] = [];
  const worker: string[] = [];
  return {
    signedIn,
    signedOut,
    worker,
    module: {
      setWorkerUrl: (path: string) => worker.push(path),
      Map: MapDouble as unknown as MaplibreModule['Map'],
      AttributionControl: AttributionDouble as unknown as MaplibreModule['AttributionControl'],
      addProtocol: (name: string) => signedIn.push(name),
      removeProtocol: (name: string) => signedOut.push(name),
    },
  };
}

async function adapter(): Promise<{
  adapter: MapLibreAdapter;
  map: MapDouble;
  signedIn: string[];
  signedOut: string[];
  worker: string[];
}> {
  const { module: m, signedIn, signedOut, worker } = module();
  const adapter = new MapLibreAdapter(() => Promise.resolve(m));
  await adapter.start(document.createElement('div'), OPTIONEN);
  const map = MapDouble.last;
  if (!map) throw new Error('Der Adapter hat keine Karte gebaut.');
  return { adapter, map, signedIn, signedOut, worker };
}

describe('MapLibreAdapter', () => {
  it('nennt den Worker-Pfad und meldet das Protokoll an, bevor die Karte entsteht', async () => {
    const { map, signedIn, worker } = await adapter();

    expect(worker).toEqual([WORKER_PATH]);
    expect(WORKER_PATH.startsWith('/assets/')).toBe(true);
    expect(signedIn).toEqual(['wert']);
    expect(map.options['minZoom']).toBe(5);
    expect(map.options['maxBounds']).toEqual(OPTIONEN.maxBounds);
    expect(map.options['attributionControl']).toBe(false);
    expect(map.controls[0].location).toBe('bottom-left');
  });

  it('legt die erste Woche sofort sichtbar auf die Karte', async () => {
    const { adapter: a, map } = await adapter();

    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    expect(map.opacity.get('wert-vorhersage-b')).toBe(1);
    expect(map.sources.has('wert-vorhersage-b')).toBe(true);
  });

  it('blendet die zweite Woche erst ein, wenn ihre Kacheln da sind', async () => {
    const { adapter: a, map } = await adapter();
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
    map.sourceReady = false;

    a.showValue('vorhersage', 'wert://art/w41/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    expect(map.opacity.get('wert-vorhersage-a')).toBe(0);
    expect(map.layers.has('wert-vorhersage-b')).toBe(true);

    map.settle('sourcedata');

    expect(map.opacity.get('wert-vorhersage-a')).toBe(0);

    map.sourceReady = true;
    map.settle('sourcedata', 'wert-vorhersage-b');

    expect(map.opacity.get('wert-vorhersage-a')).toBe(0);

    map.settle('sourcedata');

    expect(map.opacity.get('wert-vorhersage-a')).toBe(1);
    expect(map.layers.has('wert-vorhersage-b')).toBe(false);
    expect(map.sources.has('wert-vorhersage-b')).toBe(false);
  });

  it('zeigt die neue Woche auch dann, wenn eine Kachel ausbleibt', async () => {
    vi.useFakeTimers();
    try {
      const { adapter: a, map } = await adapter();
      a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
      map.sourceReady = false;

      a.showValue('vorhersage', 'wert://art/w41/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
      vi.advanceTimersByTime(1500);

      expect(map.opacity.get('wert-vorhersage-a')).toBe(1);
      expect(map.layers.has('wert-vorhersage-b')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bringt einen offenen Tausch zu Ende, bevor die dritte Woche kommt', async () => {
    const { adapter: a, map } = await adapter();
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
    map.sourceReady = false;
    a.showValue('vorhersage', 'wert://art/w41/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    a.showValue('vorhersage', 'wert://art/w42/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    expect(map.layers.size).toBe(2);
    expect([...map.opacity.values()].some((value) => value === 1)).toBe(true);
  });

  it('legt dieselbe Woche nicht zweimal auf', async () => {
    const { adapter: a, map } = await adapter();

    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    expect(map.sources.size).toBe(1);
  });

  it('legt die Wertkacheln nach einem Stilwechsel wieder auf', async () => {
    const { adapter: a, map } = await adapter();
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
    map.sources.clear();
    map.layers.clear();

    a.setStyle('dunkel');
    map.onceHandlers.get('style.load')?.();

    expect(map.styles).toEqual(['dunkel']);
    expect(map.sources.has('wert-vorhersage-b')).toBe(true);
  });

  it('passt ein, polstert und liest den Ausschnitt', async () => {
    const { adapter: a, map } = await adapter();
    const padding = { top: 0, bottom: 300, left: 0, right: 0 };

    a.fitBounds(OPTIONEN.maxBounds, padding);
    a.setPadding(padding);

    expect(map.padding[0]).toEqual(padding);
    expect(map.fitted[0]).toEqual({ bounds: OPTIONEN.maxBounds, options: { duration: 0 } });
    expect(map.moved[0]).toEqual({ padding: padding, duration: 220 });
    expect(a.extent()).toEqual({
      zoom: 7,
      extent: { west: 9, south: 50, ost: 11, nord: 52 },
    });
  });

  it('meldet Bewegungen weiter', async () => {
    const { adapter: a, map } = await adapter();
    let calls = 0;

    a.onMove(() => (calls += 1));
    map.settle('moveend');

    expect(calls).toBe(1);
  });

  it('räumt Karte und Protokoll weg', async () => {
    const { adapter: a, map, signedOut } = await adapter();

    a.destroy();

    expect(map.removed).toBe(true);
    expect(signedOut).toEqual(['wert']);
    expect(a.extent()).toBeNull();
  });

  it('nennt die Mitte des freien Streifens als Ort unter dem Fadenkreuz', async () => {
    const { adapter: a } = await adapter();

    expect(a.center()).toEqual([9.05, 48.52]);
  });

  it('fährt zu einem Ort', async () => {
    const { adapter: a, map } = await adapter();

    a.flyTo([9.1, 48.6], 13);

    expect(map.moved.at(-1)).toMatchObject({ center: [9.1, 48.6], zoom: 13 });
  });

  it('legt Zonen als Fläche und Linie in ihrer Farbe auf die Karte', async () => {
    const { adapter: a, map } = await adapter();

    a.showObjects('zonen', collection('zone-eins'));

    expect(map.sources.has('objekte-zonen')).toBe(true);
    expect(map.layers.has('objekte-zonen-flaeche')).toBe(true);
    expect(map.layers.has('objekte-zonen-linie')).toBe(true);
  });

  it('macht aus einem gerundeten geteilten Fund einen großen blassen Kreis', async () => {
    const { adapter: a, map } = await adapter();

    a.showObjects('geteilteFunde', collection('geteilt-eins'));

    const paintLayer = map.layers.get('objekte-geteilteFunde-punkt') as {
      paint: Record<string, unknown>;
    };
    expect(paintLayer.paint['circle-radius']).toEqual(['case', ['get', 'gerundet'], 18, 7]);
  });

  it('schreibt neue Daten in eine Quelle, die schon steht', async () => {
    const { adapter: a, map } = await adapter();

    a.showObjects('marker', collection('marker-eins'));
    a.showObjects('marker', collection('marker-zwei'));

    const source = map.sources.get('objekte-marker') as { data: { features: { id: string }[] } };
    expect(source.data.features[0].id).toBe('marker-zwei');
    expect(map.layers.size).toBe(1);
  });

  it('meldet die Kennung des angetippten Objekts', async () => {
    const { adapter: a, map } = await adapter();
    const tapped: string[] = [];
    a.onObjectSelect((_layer, id) => tapped.push(id));
    a.showObjects('funde', collection('fund-eins'));

    map.tap('objekte-funde-punkt', 'fund-eins');
    // Ein Punkt ohne Kennung öffnet nichts.
    for (const entry of map.handler) {
      if (entry.kind === 'click:objekte-funde-punkt') entry.handler({ features: [] });
    }

    expect(tapped).toEqual(['fund-eins']);
  });

  it('nimmt eine Ebene samt ihrer Anmeldung wieder weg', async () => {
    const { adapter: a, map } = await adapter();
    a.showObjects('marker', collection('marker-eins'));

    a.hideObjects('marker');

    expect(map.sources.has('objekte-marker')).toBe(false);
    expect(map.handler.some((entry) => entry.kind.startsWith('click:'))).toBe(false);
  });

  it('legt die Objekte nach einem Stilwechsel neu auf', async () => {
    const { adapter: a, map } = await adapter();
    a.showObjects('marker', collection('marker-eins'));

    a.setStyle('dunkel');
    map.sources.clear();
    map.layers.clear();
    map.onceHandlers.get('style.load')?.();

    expect(map.sources.has('objekte-marker')).toBe(true);
  });

  it('gibt die rohe Karte für Terra Draw her', async () => {
    const { adapter: a, map } = await adapter();

    expect(a.rawMap()).toBe(map);

    a.destroy();

    expect(a.rawMap()).toBeNull();
    expect(a.center()).toBeNull();
  });

  it('bleibt still, solange keine Karte da ist', () => {
    const a = new MapLibreAdapter(() => Promise.resolve(module().module));

    a.setStyle('hell');
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
    a.fitBounds(OPTIONEN.maxBounds, { top: 0, bottom: 0, left: 0, right: 0 });
    a.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    a.onMove(() => undefined);
    a.flyTo([9, 48]);
    a.showObjects('marker', collection('marker-eins'));
    a.hideObjects('marker');
    a.destroy();

    expect(a.extent()).toBeNull();
  });

  it('legt die Vorhersage unter die Ebene', async () => {
    const { adapter: a, map } = await adapter();

    a.showValue('ebene', 'wert://ebene-wald/f/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    expect(map.layers.has('wert-ebene-b')).toBe(true);
    expect(map.layers.has('wert-vorhersage-b')).toBe(true);
    expect(map.placedBefore.get('wert-vorhersage-b')).toBe('wert-ebene-b');
    expect(map.placedBefore.get('wert-ebene-b')).toBeUndefined();
  });

  it('räumt eine Rolle ab, wenn sie nichts mehr zeigt', async () => {
    const { adapter: a, map } = await adapter();
    a.showValue('ebene', 'wert://ebene-wald/f/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    a.showValue('ebene', null, OPTIONEN.maxBounds, 5, 8);

    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
  });

  it('setzt die Deckkraft nur auf der sichtbaren Ebene einer Rolle', async () => {
    const { adapter: a, map } = await adapter();
    a.showValue('vorhersage', 'wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    a.setOpacity('vorhersage', 0.4);

    expect(map.opacity.get('wert-vorhersage-b')).toBeCloseTo(0.4);

    map.sourceReady = false;
    a.showValue('vorhersage', 'wert://art/w41/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    expect(map.opacity.get('wert-vorhersage-a')).toBe(0);

    map.sourceReady = true;
    map.settle('sourcedata', 'wert-vorhersage-a');

    expect(map.opacity.get('wert-vorhersage-a')).toBeCloseTo(0.4);
  });

  it('hält die Deckkraft zwischen null und voll', async () => {
    const { adapter: a, map } = await adapter();
    a.showValue('ebene', 'wert://ebene-wald/f/{z}/{x}/{y}', OPTIONEN.maxBounds, 5, 8);

    a.setOpacity('ebene', 3);

    expect(map.opacity.get('wert-ebene-b')).toBe(1);
  });

  it('zentriert auf einen Punkt', async () => {
    const { adapter: a, map } = await adapter();

    a.centerOn([9.1, 48.8], 11);

    expect(map.moved.at(-1)).toEqual({ center: [9.1, 48.8], zoom: 11, duration: 600 });
  });

  it('klappt den Urheberhinweis am Telefon ein', async () => {
    const { module: m } = module();
    const host = document.createElement('div');
    const hint = document.createElement('div');
    hint.className = 'maplibregl-ctrl-attrib maplibregl-compact-show';
    host.append(hint);
    const a = new MapLibreAdapter(() => Promise.resolve(m));

    await a.start(host, { ...OPTIONEN, compact: true });

    expect(hint.classList.contains('maplibregl-compact-show')).toBe(false);
    expect(hint.classList.contains('maplibregl-compact')).toBe(true);
  });
});
