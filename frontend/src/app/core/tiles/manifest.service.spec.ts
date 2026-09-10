import { TestBed } from '@angular/core/testing';
import { ManifestService } from './manifest.service';

function reply(data: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: () => Promise.resolve(data) } as Response;
}

describe('ManifestDienst', () => {
  it('holt ein Manifest genau einmal je Art', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply({ name: 'boletus_edulis', top: 0.5 })));
    vi.stubGlobal('fetch', fetcher);
    const service = TestBed.inject(ManifestService);

    const [first, second] = await Promise.all([service.get('boletus_edulis'), service.get('boletus_edulis')]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/boletus_edulis.json');
    expect(first.top).toBe(0.5);
    expect(second).toBe(first);
  });

  it('meldet eine fehlende Datei und merkt sich den Fehlschlag nicht', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply(null, false)));
    vi.stubGlobal('fetch', fetcher);
    const service = TestBed.inject(ManifestService);

    await expect(service.get('gibtesnicht')).rejects.toThrow('404');

    fetcher.mockResolvedValue(reply({ top: 1 }));
    await expect(service.get('gibtesnicht')).resolves.toBeDefined();
  });
});
