import { MapLibreAdapter, type KartenOptionen, type MaplibreModul } from './map-adapter';

interface Ereignis {
  typ: string;
  hoerer: () => void;
}

/** Eine MapLibre-Karte ohne WebGL, so weit der Adapter sie anfasst. */
class KarteAttrappe {
  static letzte: KarteAttrappe | null = null;
  readonly quellen = new Map<string, object>();
  readonly ebenen = new Map<string, object>();
  readonly deckkraft = new Map<string, number>();
  readonly hoerer: Ereignis[] = [];
  einmal = new Map<string, () => void>();
  stile: string[] = [];
  eingepasst: unknown[] = [];
  bewegt: unknown[] = [];
  entfernt = false;
  quelleFertig = true;

  constructor(readonly optionen: Record<string, unknown>) {
    KarteAttrappe.letzte = this;
  }

  setStyle(stil: string): void {
    this.stile.push(stil);
  }

  once(typ: string, hoerer: () => void): void {
    this.einmal.set(typ, hoerer);
  }

  on(typ: string, hoerer: () => void): void {
    this.hoerer.push({ typ, hoerer });
  }

  off(typ: string, hoerer: () => void): void {
    const index = this.hoerer.findIndex((e) => e.typ === typ && e.hoerer === hoerer);
    if (index >= 0) this.hoerer.splice(index, 1);
  }

  loese(typ: string): void {
    for (const eintrag of [...this.hoerer]) if (eintrag.typ === typ) eintrag.hoerer();
  }

  addSource(id: string, quelle: object): void {
    this.quellen.set(id, quelle);
  }

  addLayer(ebene: { id: string; paint: Record<string, number> }): void {
    this.ebenen.set(ebene.id, ebene);
    this.deckkraft.set(ebene.id, ebene.paint['raster-opacity']);
  }

  getSource(id: string): object | undefined {
    return this.quellen.get(id);
  }

  getLayer(id: string): object | undefined {
    return this.ebenen.get(id);
  }

  removeLayer(id: string): void {
    this.ebenen.delete(id);
  }

  removeSource(id: string): void {
    this.quellen.delete(id);
  }

  setPaintProperty(id: string, _name: string, wert: number): void {
    this.deckkraft.set(id, wert);
  }

  isSourceLoaded(): boolean {
    return this.quelleFertig;
  }

  fitBounds(grenzen: unknown, optionen: unknown): void {
    this.eingepasst.push({ grenzen, optionen });
  }

  easeTo(optionen: unknown): void {
    this.bewegt.push(optionen);
  }

  getBounds(): Record<string, () => number> {
    return { getWest: () => 9, getSouth: () => 50, getEast: () => 11, getNorth: () => 52 };
  }

  getZoom(): number {
    return 7;
  }

  remove(): void {
    this.entfernt = true;
  }
}

const OPTIONEN: KartenOptionen = {
  stil: 'hell',
  zentrum: [10.4, 51.2],
  zoom: 5,
  minZoom: 5,
  maxZoom: 14,
  maxGrenzen: [
    [4, 46],
    [16, 56],
  ],
  urheber: '© OpenStreetMap',
  protokoll: { name: 'wert', aufloesen: () => Promise.resolve({ data: new ArrayBuffer(0) }) },
};

function modul(): { modul: MaplibreModul; angemeldet: string[]; abgemeldet: string[] } {
  const angemeldet: string[] = [];
  const abgemeldet: string[] = [];
  return {
    angemeldet,
    abgemeldet,
    modul: {
      Map: KarteAttrappe as unknown as MaplibreModul['Map'],
      addProtocol: (name: string) => angemeldet.push(name),
      removeProtocol: (name: string) => abgemeldet.push(name),
    },
  };
}

async function adapter(): Promise<{
  adapter: MapLibreAdapter;
  karte: KarteAttrappe;
  angemeldet: string[];
  abgemeldet: string[];
}> {
  const { modul: m, angemeldet, abgemeldet } = modul();
  const adapter = new MapLibreAdapter(() => Promise.resolve(m));
  await adapter.starte(document.createElement('div'), OPTIONEN);
  const karte = KarteAttrappe.letzte;
  if (!karte) throw new Error('Der Adapter hat keine Karte gebaut.');
  return { adapter, karte, angemeldet, abgemeldet };
}

describe('MapLibreAdapter', () => {
  it('meldet das Protokoll an, bevor die Karte entsteht', async () => {
    const { karte, angemeldet } = await adapter();

    expect(angemeldet).toEqual(['wert']);
    expect(karte.optionen['minZoom']).toBe(5);
    expect(karte.optionen['maxBounds']).toEqual(OPTIONEN.maxGrenzen);
    expect(karte.optionen['attributionControl']).toEqual({
      compact: false,
      customAttribution: '© OpenStreetMap',
    });
  });

  it('legt die erste Woche sofort sichtbar auf die Karte', async () => {
    const { adapter: a, karte } = await adapter();

    a.zeigeWert('wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);

    expect(karte.deckkraft.get('wert-b')).toBe(1);
    expect(karte.quellen.has('wert-b')).toBe(true);
  });

  it('blendet die zweite Woche erst ein, wenn ihre Kacheln da sind', async () => {
    const { adapter: a, karte } = await adapter();
    a.zeigeWert('wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);
    karte.quelleFertig = false;

    a.zeigeWert('wert://art/w41/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);

    expect(karte.deckkraft.get('wert-a')).toBe(0);
    expect(karte.ebenen.has('wert-b')).toBe(true);

    karte.loese('idle');

    expect(karte.deckkraft.get('wert-a')).toBe(0);

    karte.quelleFertig = true;
    karte.loese('idle');

    expect(karte.deckkraft.get('wert-a')).toBe(1);
    expect(karte.ebenen.has('wert-b')).toBe(false);
    expect(karte.quellen.has('wert-b')).toBe(false);
  });

  it('legt dieselbe Woche nicht zweimal auf', async () => {
    const { adapter: a, karte } = await adapter();

    a.zeigeWert('wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);
    a.zeigeWert('wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);

    expect(karte.quellen.size).toBe(1);
  });

  it('legt die Wertkacheln nach einem Stilwechsel wieder auf', async () => {
    const { adapter: a, karte } = await adapter();
    a.zeigeWert('wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);
    karte.quellen.clear();
    karte.ebenen.clear();

    a.setzeStil('dunkel');
    karte.einmal.get('styledata')?.();

    expect(karte.stile).toEqual(['dunkel']);
    expect(karte.quellen.has('wert-b')).toBe(true);
  });

  it('passt ein, polstert und liest den Ausschnitt', async () => {
    const { adapter: a, karte } = await adapter();
    const polster = { top: 0, bottom: 300, left: 0, right: 0 };

    a.passeEin(OPTIONEN.maxGrenzen, polster);
    a.setzePolster(polster);

    expect(karte.eingepasst[0]).toEqual({
      grenzen: OPTIONEN.maxGrenzen,
      optionen: { padding: polster, duration: 0 },
    });
    expect(karte.bewegt[0]).toEqual({ padding: polster, duration: 220 });
    expect(a.ausschnitt()).toEqual({
      zoom: 7,
      ausschnitt: { west: 9, sued: 50, ost: 11, nord: 52 },
    });
  });

  it('meldet Bewegungen weiter', async () => {
    const { adapter: a, karte } = await adapter();
    let gerufen = 0;

    a.beiBewegung(() => (gerufen += 1));
    karte.loese('moveend');

    expect(gerufen).toBe(1);
  });

  it('räumt Karte und Protokoll weg', async () => {
    const { adapter: a, karte, abgemeldet } = await adapter();

    a.zerstoere();

    expect(karte.entfernt).toBe(true);
    expect(abgemeldet).toEqual(['wert']);
    expect(a.ausschnitt()).toBeNull();
  });

  it('bleibt still, solange keine Karte da ist', () => {
    const a = new MapLibreAdapter(() => Promise.resolve(modul().modul));

    a.setzeStil('hell');
    a.zeigeWert('wert://art/w40/{z}/{x}/{y}', OPTIONEN.maxGrenzen, 5, 8);
    a.passeEin(OPTIONEN.maxGrenzen, { top: 0, bottom: 0, left: 0, right: 0 });
    a.setzePolster({ top: 0, bottom: 0, left: 0, right: 0 });
    a.beiBewegung(() => undefined);
    a.zerstoere();

    expect(a.ausschnitt()).toBeNull();
  });
});
