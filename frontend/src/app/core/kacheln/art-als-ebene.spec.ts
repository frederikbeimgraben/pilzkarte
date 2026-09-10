import { ebeneAusArt } from './art-als-ebene';
import { leseManifest } from './manifest';

const MANIFEST = leseManifest(
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
    const ebene = ebeneAusArt(MANIFEST, 'Steinpilz');

    expect(ebene.id).toBe('boletus_edulis');
    expect(ebene.label).toBe('Steinpilz');
    expect(ebene.fest).toBe(false);
    expect(ebene.low).toBe(0);
    expect(ebene.high).toBeCloseTo(0.5);
    expect(ebene.kachelPfad).toBe('boletus_edulis_kacheln');
    expect(ebene.wochen).toEqual(['2025W39', '2025W40']);
    expect(ebene.vorhanden).toBe(MANIFEST.vorhanden);
  });

  it('nimmt nur die Wochen mit Histogramm auf', () => {
    const ebene = ebeneAusArt(MANIFEST, 'Steinpilz');

    expect([...ebene.histogramme.keys()]).toEqual(['2025W39']);
    expect(ebene.histogramm).toBeNull();
  });

  it('kommt ohne Wochen zurecht', () => {
    const leer = ebeneAusArt(leseManifest({ top: 1 }, 'pfifferling'), 'Pfifferling');

    expect(leer.kachelPfad).toBe('');
    expect(leer.wochen).toEqual([]);
  });
});
