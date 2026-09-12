import { currentWeek, isoWoche, barShares, findWeek, tileKey, readManifest, weekKey } from './manifest';

const RAW = {
  name: 'boletus_edulis',
  species: ['Boletus edulis', 42],
  top: 0.5043,
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  tiles: { zooms: [5, 8], have: { '5': ['16/10', '16/11'], '7': ['66/42'] } },
  weeks: [
    { year: 2025, week: 39, forecast: false, tiles: 'boletus_edulis_kacheln/2025W39', mean: 0.05, max: 0.3 },
    { year: 2025, week: 40, forecast: false, tiles: 'boletus_edulis_kacheln/2025W40', mean: 0.1, max: 0.5 },
    { year: 2026, week: 1, forecast: true, tiles: 'boletus_edulis_kacheln/2026W01', mean: 0.02, max: 0.2 },
    { year: 2026, week: 2 },
  ],
};

describe('Manifest', () => {
  it('liest Grenzen als Länge und Breite, Wochen und die vorhandenen Kacheln', () => {
    const manifest = readManifest(RAW, 'boletus_edulis');

    expect(manifest.slug).toBe('boletus_edulis');
    expect(manifest.arten).toEqual(['Boletus edulis']);
    expect(manifest.top).toBeCloseTo(0.5043);
    expect(manifest.bounds).toEqual([
      [4.93, 47.14],
      [15.14, 55.25],
    ]);
    expect(manifest.zoomVon).toBe(5);
    expect(manifest.zoomBis).toBe(8);
    expect(manifest.existing.has('5/16/10')).toBe(true);
    expect(manifest.existing.has('7/66/43')).toBe(false);
    expect(manifest.wochen).toHaveLength(3);
    expect(manifest.wochen[2]).toEqual({
      jahr: 2026,
      woche: 1,
      forecast: true,
      tilePath: 'boletus_edulis_kacheln/2026W01',
      mean: 0.02,
      max: 0.2,
      histogramm: null,
    });
  });

  it('macht aus einem leeren Manifest eine leere Art statt eines Fehlers', () => {
    const manifest = readManifest(null, 'pfifferling');

    expect(manifest.wochen).toEqual([]);
    expect(manifest.top).toBe(1);
    expect(manifest.zoomVon).toBe(5);
    expect(manifest.existing.size).toBe(0);
    expect(currentWeek(manifest)).toBeNull();
  });

  it('nimmt die laufende Kalenderwoche, wenn das Manifest sie hat', () => {
    const manifest = readManifest(RAW, 'boletus_edulis');

    // Der 2. Oktober 2025 liegt in der KW 40, der 6. Januar 2026 in der KW 2.
    expect(currentWeek(manifest, new Date('2025-10-02'))?.woche).toBe(40);
    expect(isoWoche(new Date('2025-10-02'))).toEqual({ jahr: 2025, woche: 40 });
    expect(isoWoche(new Date('2026-01-06'))).toEqual({ jahr: 2026, woche: 2 });
  });

  it('nimmt auch eine Prognosewoche, wenn heute in ihr liegt', () => {
    const manifest = readManifest(RAW, 'boletus_edulis');

    // Der 1. Januar 2026 liegt in der KW 1, die im Manifest Prognose ist.
    expect(currentWeek(manifest, new Date('2026-01-01'))?.forecast).toBe(true);
  });

  it('nimmt die jüngste Woche, wenn heute über das Manifest hinaus ist', () => {
    const manifest = readManifest(RAW, 'boletus_edulis');

    expect(currentWeek(manifest, new Date('2026-06-01'))?.woche).toBe(1);
  });

  it('nimmt die jüngste Woche, wenn alle Prognose sind', () => {
    const forecastOnly = { ...RAW, weeks: [{ ...RAW.weeks[2] }] };

    expect(currentWeek(readManifest(forecastOnly, 'boletus_edulis'), new Date('2026-06-01'))?.woche).toBe(1);
  });

  it('findet eine Woche über ihren Schlüssel', () => {
    const manifest = readManifest(RAW, 'boletus_edulis');

    expect(findWeek(manifest, '2026-01')?.jahr).toBe(2026);
    expect(findWeek(manifest, '2026-40')).toBeNull();
  });

  it('rechnet die Balken relativ zur besten Woche', () => {
    const anteile = barShares(readManifest(RAW, 'boletus_edulis'));

    expect(anteile[0]).toBeCloseTo(0.5);
    expect(anteile[1]).toBe(1);
    expect(anteile[2]).toBeCloseTo(0.2);
  });

  it('schreibt Wochen- und Kachelschlüssel in fester Form', () => {
    expect(weekKey({ jahr: 2025, woche: 7 })).toBe('2025-07');
    expect(tileKey(7, 66, 42)).toBe('7/66/42');
  });
});
