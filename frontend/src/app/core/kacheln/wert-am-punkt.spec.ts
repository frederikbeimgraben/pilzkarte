import { leseManifest } from './manifest';
import { kachelort, wertAmPunkt, wertAusByte } from './wert-am-punkt';

const MANIFEST = leseManifest(
  {
    top: 0.5,
    bounds: [
      [47.14, 4.93],
      [55.25, 15.14],
    ],
    tiles: { zooms: [7, 8], have: { '8': ['134/88'] } },
    weeks: [],
  },
  'boletus_edulis',
);

/** Eine Leinwand, die immer denselben Punktwert liefert. */
function leinwandMit(byte: number): void {
  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 256, height: 256, close: () => undefined }),
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext(): { drawImage: () => void; getImageData: () => { data: number[] } } | null {
        return {
          drawImage: () => undefined,
          getImageData: () => ({ data: [byte, byte, byte, 255] }),
        };
      }
    },
  );
}

describe('wertAmPunkt', () => {
  it('rechnet Länge und Breite auf Kachel und Punkt um', () => {
    const ort = kachelort(9.05, 48.52, 8);

    expect(ort.z).toBe(8);
    expect(ort.x).toBe(134);
    expect(ort.y).toBe(88);
    expect(ort.punktX).toBeGreaterThanOrEqual(0);
    expect(ort.punktY).toBeLessThan(256);
  });

  it('klemmt einen Ort außerhalb des Rasters auf den Rand', () => {
    expect(kachelort(-200, 89, 2).x).toBe(0);
    expect(kachelort(200, -89, 2).x).toBe(3);
  });

  it('liest Byte 0 als „keine Daten“', () => {
    expect(wertAusByte(0, 0.5)).toBeNull();
    expect(wertAusByte(255, 0.5)).toBeCloseTo(0.5);
    expect(wertAusByte(1, 0.5)).toBe(0);
  });

  it('holt die feinste vorhandene Kachel und liest den Punkt', async () => {
    leinwandMit(128);
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) }));

    const wert = await wertAmPunkt(MANIFEST, 'boletus_edulis_kacheln/2025W40', 9.05, 48.52);

    expect(wert).toBeCloseTo((127 / 254) * 0.5, 5);
  });

  it('gibt nichts her, wenn die Kachel fehlt', async () => {
    expect(await wertAmPunkt(MANIFEST, 'ordner', 13.4, 52.5)).toBeNull();
  });

  it('gibt nichts her, wenn die Kachel nicht kommt', async () => {
    leinwandMit(200);
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false }));

    expect(await wertAmPunkt(MANIFEST, 'ordner', 9.05, 48.52)).toBeNull();
  });

  it('gibt nichts her, wenn das Netz bricht', async () => {
    leinwandMit(200);
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));

    expect(await wertAmPunkt(MANIFEST, 'ordner', 9.05, 48.52)).toBeNull();
  });

  it('gibt nichts her, wenn der Browser keine Leinwand hergibt', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 256, height: 256, close: () => undefined }),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext(): null {
          return null;
        }
      },
    );
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) }));

    expect(await wertAmPunkt(MANIFEST, 'ordner', 9.05, 48.52)).toBeNull();
  });
});
