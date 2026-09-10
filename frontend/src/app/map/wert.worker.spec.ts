import { baueLut } from './wert-farben';
import { VORHERSAGE_RAMPE as RAMPE } from '../ui/ramp/rampe-farben';
import type { WertAntwort, WertAuftrag } from './wert-nachrichten';

/** Ein Ersatz für OffscreenCanvas: er merkt sich die Punkte, die er bekommt. */
class LeinwandAttrappe {
  static letzte: LeinwandAttrappe | null = null;
  punkte: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray([1, 1, 1, 255, 0, 0, 0, 255]);
  gezeichnet = 0;
  zurueck: object | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    LeinwandAttrappe.letzte = this;
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
});
