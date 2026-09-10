import { LAYERS_MANIFEST, FORECAST_SLUGS, findsPath, tilePath, manifestPath } from './tile-paths';

describe('Kachelpfade', () => {
  it('nennt die Arten mit Vorhersage in der Schreibweise des Renderings', () => {
    expect(FORECAST_SLUGS).toContain('boletus_edulis');
    expect(new Set(FORECAST_SLUGS).size).toBe(FORECAST_SLUGS.length);
  });

  it('baut Manifest, Kachel und Funde nach dem Muster des Renderings', () => {
    expect(manifestPath('boletus_edulis')).toBe('/boletus_edulis.json');
    expect(tilePath('boletus_edulis_kacheln/2026W07', 9, 271, 176)).toBe(
      '/boletus_edulis_kacheln/2026W07/9/271/176.png',
    );
    expect(findsPath('pfifferling')).toBe('/funde/pfifferling.json');
    expect(LAYERS_MANIFEST).toBe('/layers.json');
  });
});
