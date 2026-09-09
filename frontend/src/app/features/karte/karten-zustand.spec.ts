import { TestBed } from '@angular/core/testing';
import { KartenZustand, STANDARD_ART } from './karten-zustand';

describe('KartenZustand', () => {
  it('beginnt beim Steinpilz und der aktuellen Woche', () => {
    const zustand = TestBed.inject(KartenZustand);

    expect(zustand.art()).toBe('boletus_edulis');
    expect(STANDARD_ART).toBe('boletus_edulis');
    expect(zustand.woche()).toBeNull();
    expect(zustand.darstellung()).toBe('vorhersage');
    expect(zustand.adresse()).toEqual({ art: 'boletus_edulis', kw: null });
  });

  it('übernimmt Art, Woche und Darstellung aus der Adresse', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm('pfifferling', '2025-40', 'ebene');

    expect(zustand.adresse()).toEqual({ art: 'pfifferling', kw: '2025-40' });
    expect(zustand.darstellung()).toBe('ebene');
  });

  it('fällt bei unbekannter Art und falscher Wochenform auf den Standard zurück', () => {
    const zustand = TestBed.inject(KartenZustand);
    zustand.uebernimm('pfifferling', '2025-40');

    zustand.uebernimm('trüffel', 'KW40', 'unsinn');

    expect(zustand.art()).toBe('boletus_edulis');
    expect(zustand.woche()).toBeNull();
    expect(zustand.darstellung()).toBe('vorhersage');
  });

  it('nimmt eine leere Adresse als „Standardart, aktuelle Woche“', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm(null, null);

    expect(zustand.adresse()).toEqual({ art: 'boletus_edulis', kw: null });
  });
});
