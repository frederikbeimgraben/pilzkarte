import { SCHNITT_DECKKRAFT, baueLut, zuRgb } from './wert-farben';
import { VORHERSAGE_RAMPE as RAMPE } from '../ui/ramp/rampe-farben';
import type { WertAntwort, WertAuftrag } from './wert-nachrichten';

/** Ein Ersatz für OffscreenCanvas: er merkt sich die Punkte, die er bekommt. */
class LeinwandAttrappe {
  static letzte: LeinwandAttrappe | null = null;
  static alle: LeinwandAttrappe[] = [];
  /** Die Punkte der nächsten Leinwände, je eine je entpackter Kachel. */
  static vorrat: number[][] = [];
  punkte: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(
    LeinwandAttrappe.vorrat.shift() ?? [1, 1, 1, 255, 0, 0, 0, 255],
  );
  gezeichnet = 0;
  zurueck: object | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    LeinwandAttrappe.letzte = this;
    LeinwandAttrappe.alle.push(this);
  }

  getContext(): object {
    return {
      drawImage: () => (this.gezeichnet += 1),
      getImageData: () => ({ data: this.punkte }),
      putImageData: (bild: { data: Uint8ClampedArray<ArrayBuffer> }) => {
        this.punkte = bild.data;
      },
    };
  }

  transferToImageBitmap(): object {
    this.zurueck = { fertig: true };
    return this.zurueck;
  }
}

interface Bereich {
  postMessage(antwort: WertAntwort, transfer: Transferable[]): void;
  addEventListener(typ: 'message', hoerer: (ereignis: MessageEvent<WertAuftrag>) => void): void;
}

/** Ein Bereich, der Aufträge annimmt und die Antworten sammelt. */
class BereichAttrappe implements Bereich {
  readonly antworten: WertAntwort[] = [];
  private hoerer: ((ereignis: MessageEvent<WertAuftrag>) => void) | null = null;

  postMessage(antwort: WertAntwort): void {
    this.antworten.push(antwort);
  }

  addEventListener(_typ: 'message', hoerer: (ereignis: MessageEvent<WertAuftrag>) => void): void {
    this.hoerer = hoerer;
  }

  sende(auftrag: WertAuftrag): void {
    this.hoerer?.({ data: auftrag } as MessageEvent<WertAuftrag>);
  }
}

async function bisAlleRuhen(): Promise<void> {
  for (let runde = 0; runde < 8; runde++) await Promise.resolve();
}

describe('Färbe-Worker', () => {
  beforeEach(() => {
    LeinwandAttrappe.letzte = null;
    LeinwandAttrappe.alle = [];
    LeinwandAttrappe.vorrat = [];
    vi.stubGlobal('OffscreenCanvas', LeinwandAttrappe);
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 2, height: 1, close: () => undefined }),
    );
  });

  it('holt eine Kachel, färbt sie und schickt das Bild zurück', async () => {
    const holen = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    vi.stubGlobal('fetch', holen);
    const { nimmAuftraege } = await import('./wert.worker');
    const bereich = new BereichAttrappe();
    nimmAuftraege(bereich);

    bereich.sende({
      typ: 'faerbe',
      id: 5,
      url: '/a/7/66/42.png',
      skala: { art: 'wahrscheinlichkeit', top: 1 },
      farben: RAMPE,
    });
    await bisAlleRuhen();

    const lut = baueLut({ art: 'wahrscheinlichkeit', top: 1 }, RAMPE);
    expect(holen).toHaveBeenCalledWith('/a/7/66/42.png');
    expect(bereich.antworten[0].id).toBe(5);
    expect(bereich.antworten[0].bild).toBe(LeinwandAttrappe.letzte?.zurueck);
    expect(LeinwandAttrappe.letzte?.punkte[3]).toBe(lut[1 * 4 + 3]);
    expect(LeinwandAttrappe.letzte?.punkte[7]).toBe(0);
  });

  it('meldet eine fehlende Kachel als leer, ohne Fehler', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const { nimmAuftraege } = await import('./wert.worker');
    const bereich = new BereichAttrappe();
    nimmAuftraege(bereich);

    bereich.sende({
      typ: 'faerbe',
      id: 1,
      url: '/fehlt/7/1/1.png',
      skala: { art: 'wahrscheinlichkeit', top: 1 },
      farben: RAMPE,
    });
    await bisAlleRuhen();

    expect(bereich.antworten[0]).toEqual({ id: 1, bild: null });
  });

  it('holt vorgeladene Kacheln nur einmal', async () => {
    const holen = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    vi.stubGlobal('fetch', holen);
    const { nimmAuftraege } = await import('./wert.worker');
    const bereich = new BereichAttrappe();
    nimmAuftraege(bereich);

    bereich.sende({ typ: 'vorladen', urls: ['/v/7/1/1.png'] });
    await bisAlleRuhen();
    bereich.sende({
      typ: 'faerbe',
      id: 2,
      url: '/v/7/1/1.png',
      skala: { art: 'spanne', low: 0, high: 10 },
      farben: RAMPE,
    });
    await bisAlleRuhen();

    expect(holen).toHaveBeenCalledTimes(1);
    expect(bereich.antworten[0].id).toBe(2);
  });

  it('rechnet mehrere Quellen zu einer Kachel zusammen', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    // Punkt 1: beide innerhalb. Punkt 2: die zweite Quelle hat keine Daten.
    LeinwandAttrappe.vorrat = [
      [200, 200, 200, 255, 200, 200, 200, 255],
      [200, 200, 200, 255, 0, 0, 0, 255],
    ];
    const { kombiniereKachel } = await import('./wert.worker');

    const bild = await kombiniereKachel({
      typ: 'kombi',
      id: 1,
      regel: 'schnitt',
      farben: ['#004225'],
      teile: [
        { url: '/k1/7/1/1.png', grenze: { von: 100, bis: 255, rand: 25 } },
        { url: '/k2/7/1/1.png', grenze: { von: 100, bis: 255, rand: 25 } },
      ],
    });
    const erste = LeinwandAttrappe.alle[0];

    expect(bild).not.toBeNull();
    const [r, g, b] = zuRgb('#004225');
    expect([erste.punkte[0], erste.punkte[1], erste.punkte[2], erste.punkte[3]]).toEqual([
      r,
      g,
      b,
      SCHNITT_DECKKRAFT,
    ]);
    expect(erste.punkte[7]).toBe(0);
  });

  it('lässt die Kachel weg, wenn einer Quelle die Kachel fehlt', async () => {
    let ruf = 0;
    vi.stubGlobal('fetch', () => {
      ruf += 1;
      return Promise.resolve(
        ruf === 1
          ? { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }
          : { ok: false, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) },
      );
    });
    const { kombiniereKachel } = await import('./wert.worker');

    const bild = await kombiniereKachel({
      typ: 'kombi',
      id: 2,
      regel: 'abgestuft',
      farben: ['#0d0827', '#fce79b'],
      teile: [
        { url: '/f1/7/2/2.png', grenze: { von: 1, bis: 255, rand: 25 } },
        { url: '/f2/7/2/2.png', grenze: { von: 1, bis: 255, rand: 25 } },
      ],
    });

    expect(bild).toBeNull();
  });

  it('nimmt einen Kombi-Auftrag über die Nachrichten an', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    const { nimmAuftraege } = await import('./wert.worker');
    const bereich = new BereichAttrappe();
    nimmAuftraege(bereich);

    bereich.sende({
      typ: 'kombi',
      id: 9,
      regel: 'abgestuft',
      farben: RAMPE,
      teile: [{ url: '/n/7/3/3.png', grenze: { von: 1, bis: 255, rand: 25 } }],
    });
    await bisAlleRuhen();

    expect(bereich.antworten[0].id).toBe(9);
    expect(bereich.antworten[0].bild).not.toBeNull();
  });
});
