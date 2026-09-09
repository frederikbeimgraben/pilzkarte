import { TestBed } from '@angular/core/testing';
import { ManifestDienst } from './manifest.service';

function antwort(daten: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: () => Promise.resolve(daten) } as Response;
}

describe('ManifestDienst', () => {
  it('holt ein Manifest genau einmal je Art', async () => {
    const holen = vi.fn(() => Promise.resolve(antwort({ name: 'boletus_edulis', top: 0.5 })));
    vi.stubGlobal('fetch', holen);
    const dienst = TestBed.inject(ManifestDienst);

    const [erst, zweit] = await Promise.all([dienst.hole('boletus_edulis'), dienst.hole('boletus_edulis')]);

    expect(holen).toHaveBeenCalledTimes(1);
    expect(holen).toHaveBeenCalledWith('/boletus_edulis.json');
    expect(erst.top).toBe(0.5);
    expect(zweit).toBe(erst);
  });

  it('meldet eine fehlende Datei und merkt sich den Fehlschlag nicht', async () => {
    const holen = vi.fn(() => Promise.resolve(antwort(null, false)));
    vi.stubGlobal('fetch', holen);
    const dienst = TestBed.inject(ManifestDienst);

    await expect(dienst.hole('gibtesnicht')).rejects.toThrow('404');

    holen.mockResolvedValue(antwort({ top: 1 }));
    await expect(dienst.hole('gibtesnicht')).resolves.toBeDefined();
  });
});
