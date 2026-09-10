import { EBENEN_MANIFEST, VORHERSAGE_SLUGS, fundePfad, kachelPfad, manifestPfad } from './kachel-pfade';

describe('Kachelpfade', () => {
  it('nennt die Arten mit Vorhersage in der Schreibweise des Renderings', () => {
    expect(VORHERSAGE_SLUGS).toContain('boletus_edulis');
    expect(new Set(VORHERSAGE_SLUGS).size).toBe(VORHERSAGE_SLUGS.length);
  });

  it('baut Manifest, Kachel und Funde nach dem Muster des Renderings', () => {
    expect(manifestPfad('boletus_edulis')).toBe('/boletus_edulis.json');
    expect(kachelPfad('boletus_edulis_kacheln/2026W07', 9, 271, 176)).toBe(
      '/boletus_edulis_kacheln/2026W07/9/271/176.png',
    );
    expect(fundePfad('pfifferling')).toBe('/funde/pfifferling.json');
    expect(EBENEN_MANIFEST).toBe('/layers.json');
  });
});
