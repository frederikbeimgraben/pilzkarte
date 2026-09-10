import { layerFromSpecies } from './species-as-layer';
import { readManifest } from './manifest';

const MANIFEST = readManifest(
  {
    top: 0.5,
    bounds: [
      [47, 5],
      [55, 15],
    ],
    tiles: { zooms: [5, 8], have: { '7': ['66/42'] } },
    weeks: [
      {
        year: 2025,
        week: 39,
        tiles: 'boletus_edulis_kacheln/2025W39',
        mean: 0.05,
        max: 0.3,
        histogramm: { klassen: [0, 0.25, 0.5], anteile: [0.8, 0.2] },
      },
      { year: 2025, week: 40, tiles: 'boletus_edulis_kacheln/2025W40', mean: 0.1, max: 0.5 },
    ],
  },
  'boletus_edulis',
);

describe('Art als Ebene', () => {
  it('bringt eine Art in die Form einer Ebene', () => {
    const layer = layerFromSpecies(MANIFEST, 'Steinpilz');

    expect(layer.id).toBe('boletus_edulis');
    expect(layer.label).toBe('Steinpilz');
    expect(layer.fixed).toBe(false);
    expect(layer.low).toBe(0);
    expect(layer.high).toBeCloseTo(0.5);
    expect(layer.tilePath).toBe('boletus_edulis_kacheln');
    expect(layer.wochen).toEqual(['2025W39', '2025W40']);
    expect(layer.existing).toBe(MANIFEST.existing);
  });

  it('nimmt nur die Wochen mit Histogramm auf', () => {
    const layer = layerFromSpecies(MANIFEST, 'Steinpilz');

    expect([...layer.histogramme.keys()]).toEqual(['2025W39']);
    expect(layer.histogramm).toBeNull();
  });

  it('kommt ohne Wochen zurecht', () => {
    const empty = layerFromSpecies(readManifest({ top: 1 }, 'pfifferling'), 'Pfifferling');

    expect(empty.tilePath).toBe('');
    expect(empty.wochen).toEqual([]);
  });
});
