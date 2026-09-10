import { TestBed } from '@angular/core/testing';
import { EbenenDienst } from './ebenen.service';

function antwort(daten: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: () => Promise.resolve(daten) } as Response;
}

describe('EbenenDienst', () => {
  it('holt `layers.json` genau einmal', async () => {
    const holen = vi.fn(() => Promise.resolve(antwort({ layers: { wald: { tiles: 'x' } } })));
    vi.stubGlobal('fetch', holen);
    const dienst = TestBed.inject(EbenenDienst);

    const [erst, zweit] = await Promise.all([dienst.hole(), dienst.hole()]);

    expect(holen).toHaveBeenCalledTimes(1);
    expect(holen).toHaveBeenCalledWith('/layers.json');
    expect(erst.ebenen).toHaveLength(1);
    expect(zweit).toBe(erst);
  });

  it('meldet einen Fehlschlag und merkt ihn sich nicht', async () => {
    const holen = vi.fn(() => Promise.resolve(antwort(null, false)));
    vi.stubGlobal('fetch', holen);
    const dienst = TestBed.inject(EbenenDienst);

    await expect(dienst.hole()).rejects.toThrow('404');

    holen.mockResolvedValue(antwort({ layers: {} }));
    await expect(dienst.hole()).resolves.toBeDefined();
  });
});
