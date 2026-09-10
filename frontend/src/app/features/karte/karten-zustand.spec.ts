import { TestBed } from '@angular/core/testing';
import { KartenZustand, STANDARD_ART, STANDARD_EBENE } from './karten-zustand';

const LEER = { art: null, kw: null, darstellung: null, ebene: null, deckkraft: null };

describe('KartenZustand', () => {
  it('beginnt beim Steinpilz, der aktuellen Woche und der Vorhersage', () => {
    const zustand = TestBed.inject(KartenZustand);

    expect(STANDARD_ART).toBe('boletus_edulis');
    expect(STANDARD_EBENE).toBe('regen_4w');
    expect(zustand.adresse()).toEqual({
      art: 'boletus_edulis',
      kw: null,
      darstellung: 'vorhersage',
      ebene: null,
      deckkraft: 100,
    });
  });

  it('übernimmt Art, Woche, Darstellung, Ebene und Deckkraft aus der Adresse', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm({
      art: 'pfifferling',
      kw: '2025-40',
      darstellung: 'ebene',
      ebene: 'regen_4w',
      deckkraft: '70',
    });

    expect(zustand.adresse()).toEqual({
      art: 'pfifferling',
      kw: '2025-40',
      darstellung: 'ebene',
      ebene: 'regen_4w',
      deckkraft: 70,
    });
    expect(zustand.deckkraft()).toBeCloseTo(0.7);
  });

  it('fällt bei unbekannten Werten auf den Standard zurück', () => {
    const zustand = TestBed.inject(KartenZustand);
    zustand.uebernimm({ ...LEER, art: 'pfifferling', kw: '2025-40', darstellung: 'ebene' });

    zustand.uebernimm({ ...LEER, art: 'trüffel', kw: 'KW40', darstellung: 'unsinn', ebene: 'Regen 4W!' });

    expect(zustand.art()).toBe('boletus_edulis');
    expect(zustand.woche()).toBeNull();
    expect(zustand.darstellung()).toBe('vorhersage');
    expect(zustand.ebene()).toBeNull();
  });

  it('hält die Deckkraft zwischen null und voll und lässt Unsinn liegen', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm({ ...LEER, deckkraft: '140' });
    expect(zustand.deckkraft()).toBe(1);

    zustand.uebernimm({ ...LEER, deckkraft: '-20' });
    expect(zustand.deckkraft()).toBe(0);

    zustand.uebernimm({ ...LEER, deckkraft: 'viel' });
    expect(zustand.deckkraft()).toBe(0);
  });

  it('nimmt nur einen Hintergrund an, den es schon gibt', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.setzeHintergrund('dunkel');
    expect(zustand.hintergrund()).toBe('dunkel');

    zustand.setzeHintergrund('satellit');
    expect(zustand.hintergrund()).toBe('dunkel');
  });
});
