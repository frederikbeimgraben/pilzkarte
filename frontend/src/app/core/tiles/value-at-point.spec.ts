import { readManifest } from './manifest';
import { tileLocation, valueAtPoint, valueFromByte } from './value-at-point';

const MANIFEST = readManifest(
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
function canvasWith(byte: number): void {
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
    const location = tileLocation(9.05, 48.52, 8);

    expect(location.z).toBe(8);
    expect(location.x).toBe(134);
    expect(location.y).toBe(88);
    expect(location.pixelX).toBeGreaterThanOrEqual(0);
    expect(location.pixelY).toBeLessThan(256);
  });

  it('klemmt einen Ort außerhalb des Rasters auf den Rand', () => {
    expect(tileLocation(-200, 89, 2).x).toBe(0);
    expect(tileLocation(200, -89, 2).x).toBe(3);
  });

  it('liest Byte 0 als „keine Daten“', () => {
    expect(valueFromByte(0, 0.5)).toBeNull();
    expect(valueFromByte(255, 0.5)).toBeCloseTo(0.5);
    expect(valueFromByte(1, 0.5)).toBe(0);
  });

  it('holt die feinste vorhandene Kachel und liest den Punkt', async () => {
    canvasWith(128);
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) }));

    const value = await valueAtPoint(MANIFEST, 'boletus_edulis_kacheln/2025W40', 9.05, 48.52);

    expect(value).toBeCloseTo((127 / 254) * 0.5, 5);
  });

  it('gibt nichts her, wenn die Kachel fehlt', async () => {
    expect(await valueAtPoint(MANIFEST, 'ordner', 13.4, 52.5)).toBeNull();
  });

  it('gibt nichts her, wenn die Kachel nicht kommt', async () => {
    canvasWith(200);
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false }));

    expect(await valueAtPoint(MANIFEST, 'ordner', 9.05, 48.52)).toBeNull();
  });

  it('gibt nichts her, wenn das Netz bricht', async () => {
    canvasWith(200);
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));

    expect(await valueAtPoint(MANIFEST, 'ordner', 9.05, 48.52)).toBeNull();
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

    expect(await valueAtPoint(MANIFEST, 'ordner', 9.05, 48.52)).toBeNull();
  });
});
