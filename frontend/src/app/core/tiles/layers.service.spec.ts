import { TestBed } from '@angular/core/testing';
import { LayersService } from './layers.service';

function reply(data: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: () => Promise.resolve(data) } as Response;
}

describe('EbenenDienst', () => {
  it('holt `layers.json` genau einmal', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply({ layers: { wald: { tiles: 'x' } } })));
    vi.stubGlobal('fetch', fetcher);
    const service = TestBed.inject(LayersService);

    const [first, second] = await Promise.all([service.get(), service.get()]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/layers.json');
    expect(first.layers).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('meldet einen Fehlschlag und merkt ihn sich nicht', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply(null, false)));
    vi.stubGlobal('fetch', fetcher);
    const service = TestBed.inject(LayersService);

    await expect(service.get()).rejects.toThrow('404');

    fetcher.mockResolvedValue(reply({ layers: {} }));
    await expect(service.get()).resolves.toBeDefined();
  });
});
