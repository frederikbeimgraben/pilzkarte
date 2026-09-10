import { INTERSECTION_OPACITY, createLut, zuRgb } from './value-colors';
import { FORECAST_RAMP as RAMP } from '../ui/ramp/ramp-colors';
import type { ValueReply, ValueJob } from './value-messages';

/** Ein Ersatz für OffscreenCanvas: er merkt sich die Punkte, die er bekommt. */
class CanvasDouble {
  static last: CanvasDouble | null = null;
  static alle: CanvasDouble[] = [];
  /** Die Punkte der nächsten Leinwände, je eine je entpackter Kachel. */
  static cache: number[][] = [];
  punkte: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(
    CanvasDouble.cache.shift() ?? [1, 1, 1, 255, 0, 0, 0, 255],
  );
  drawn = 0;
  back: object | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    CanvasDouble.last = this;
    CanvasDouble.alle.push(this);
  }

  getContext(): object {
    return {
      drawImage: () => (this.drawn += 1),
      getImageData: () => ({ data: this.punkte }),
      putImageData: (shot: { data: Uint8ClampedArray<ArrayBuffer> }) => {
        this.punkte = shot.data;
      },
    };
  }

  transferToImageBitmap(): object {
    this.back = { done: true };
    return this.back;
  }
}

interface Scope {
  postMessage(reply: ValueReply, transfer: Transferable[]): void;
  addEventListener(kind: 'message', handler: (event: MessageEvent<ValueJob>) => void): void;
}

/** Ein Bereich, der Aufträge annimmt und die Antworten sammelt. */
class ScopeDouble implements Scope {
  readonly replies: ValueReply[] = [];
  private handler: ((event: MessageEvent<ValueJob>) => void) | null = null;

  postMessage(reply: ValueReply): void {
    this.replies.push(reply);
  }

  addEventListener(_kind: 'message', handler: (event: MessageEvent<ValueJob>) => void): void {
    this.handler = handler;
  }

  send(job: ValueJob): void {
    this.handler?.({ data: job } as MessageEvent<ValueJob>);
  }
}

async function untilAllIdle(): Promise<void> {
  for (let round = 0; round < 8; round++) await Promise.resolve();
}

describe('Färbe-Worker', () => {
  beforeEach(() => {
    CanvasDouble.last = null;
    CanvasDouble.alle = [];
    CanvasDouble.cache = [];
    vi.stubGlobal('OffscreenCanvas', CanvasDouble);
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 2, height: 1, close: () => undefined }),
    );
  });

  it('holt eine Kachel, färbt sie und schickt das Bild zurück', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { takeJobs } = await import('./value.worker');
    const range = new ScopeDouble();
    takeJobs(range);

    range.send({
      kind: 'faerbe',
      id: 5,
      url: '/a/7/66/42.png',
      scale: { art: 'wahrscheinlichkeit', top: 1 },
      colors: RAMP,
    });
    await untilAllIdle();

    const lut = createLut({ art: 'wahrscheinlichkeit', top: 1 }, RAMP);
    expect(fetcher).toHaveBeenCalledWith('/a/7/66/42.png');
    expect(range.replies[0].id).toBe(5);
    expect(range.replies[0].shot).toBe(CanvasDouble.last?.back);
    expect(CanvasDouble.last?.punkte[3]).toBe(lut[1 * 4 + 3]);
    expect(CanvasDouble.last?.punkte[7]).toBe(0);
  });

  it('meldet eine fehlende Kachel als leer, ohne Fehler', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const { takeJobs } = await import('./value.worker');
    const range = new ScopeDouble();
    takeJobs(range);

    range.send({
      kind: 'faerbe',
      id: 1,
      url: '/fehlt/7/1/1.png',
      scale: { art: 'wahrscheinlichkeit', top: 1 },
      colors: RAMP,
    });
    await untilAllIdle();

    expect(range.replies[0]).toEqual({ id: 1, shot: null });
  });

  it('holt vorgeladene Kacheln nur einmal', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { takeJobs } = await import('./value.worker');
    const range = new ScopeDouble();
    takeJobs(range);

    range.send({ kind: 'vorladen', urls: ['/v/7/1/1.png'] });
    await untilAllIdle();
    range.send({
      kind: 'faerbe',
      id: 2,
      url: '/v/7/1/1.png',
      scale: { art: 'spanne', low: 0, high: 10 },
      colors: RAMP,
    });
    await untilAllIdle();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(range.replies[0].id).toBe(2);
  });

  it('rechnet mehrere Quellen zu einer Kachel zusammen', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    // Punkt 1: beide innerhalb. Punkt 2: die zweite Quelle hat keine Daten.
    CanvasDouble.cache = [
      [200, 200, 200, 255, 200, 200, 200, 255],
      [200, 200, 200, 255, 0, 0, 0, 255],
    ];
    const { combineTile } = await import('./value.worker');

    const shot = await combineTile({
      kind: 'kombi',
      id: 1,
      rule: 'schnitt',
      colors: ['#004225'],
      parts: [
        { url: '/k1/7/1/1.png', bound: { von: 100, bis: 255, edge: 25 } },
        { url: '/k2/7/1/1.png', bound: { von: 100, bis: 255, edge: 25 } },
      ],
    });
    const first = CanvasDouble.alle[0];

    expect(shot).not.toBeNull();
    const [r, g, b] = zuRgb('#004225');
    expect([first.punkte[0], first.punkte[1], first.punkte[2], first.punkte[3]]).toEqual([
      r,
      g,
      b,
      INTERSECTION_OPACITY,
    ]);
    expect(first.punkte[7]).toBe(0);
  });

  it('lässt die Kachel weg, wenn einer Quelle die Kachel fehlt', async () => {
    let call = 0;
    vi.stubGlobal('fetch', () => {
      call += 1;
      return Promise.resolve(
        call === 1
          ? { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }
          : { ok: false, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) },
      );
    });
    const { combineTile } = await import('./value.worker');

    const shot = await combineTile({
      kind: 'kombi',
      id: 2,
      rule: 'abgestuft',
      colors: ['#0d0827', '#fce79b'],
      parts: [
        { url: '/f1/7/2/2.png', bound: { von: 1, bis: 255, edge: 25 } },
        { url: '/f2/7/2/2.png', bound: { von: 1, bis: 255, edge: 25 } },
      ],
    });

    expect(shot).toBeNull();
  });

  it('nimmt einen Kombi-Auftrag über die Nachrichten an', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
    const { takeJobs } = await import('./value.worker');
    const range = new ScopeDouble();
    takeJobs(range);

    range.send({
      kind: 'kombi',
      id: 9,
      rule: 'abgestuft',
      colors: RAMP,
      parts: [{ url: '/n/7/3/3.png', bound: { von: 1, bis: 255, edge: 25 } }],
    });
    await untilAllIdle();

    expect(range.replies[0].id).toBe(9);
    expect(range.replies[0].shot).not.toBeNull();
  });
});
