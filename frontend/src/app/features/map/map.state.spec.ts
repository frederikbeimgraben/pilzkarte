import { TestBed } from '@angular/core/testing';
import {
  MapState,
  SAVE_DELAY,
  STORAGE_KEY,
  DEFAULT_SPECIES,
  DEFAULT_LAYER,
  readObject,
  writeObject,
} from './map.state';

const EMPTY = {
  art: null,
  kw: null,
  viewMode: null,
  layer: null,
  opacity: null,
  rule: null,
  f: null,
  object: null,
};

/** Was nach der Drosselung im Speicher steht. */
function gesichert(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
}

describe('KartenZustand', () => {
  it('beginnt beim Steinpilz, der aktuellen Woche und der Vorhersage', () => {
    const state = TestBed.inject(MapState);

    expect(DEFAULT_SPECIES).toBe('boletus_edulis');
    expect(DEFAULT_LAYER).toBe('regen_4w');
    expect(state.art()).toBe('boletus_edulis');
    expect(state.woche()).toBeNull();
    expect(state.viewMode()).toBe('vorhersage');
    expect(state.factors()).toEqual([]);
    expect(state.opacity()).toBe(1);
  });

  it('nimmt die Werte eines Links an', () => {
    const state = TestBed.inject(MapState);

    state.adopt({
      ...EMPTY,
      art: 'pfifferling',
      kw: '2025-40',
      viewMode: 'ebene',
      layer: 'regen_4w',
      opacity: '70',
    });

    expect(state.art()).toBe('pfifferling');
    expect(state.woche()).toBe('2025-40');
    expect(state.viewMode()).toBe('ebene');
    expect(state.layer()).toBe('regen_4w');
    expect(state.opacity()).toBeCloseTo(0.7);
  });

  it('lässt stehen, was ein Link nicht nennt, und verwirft Unsinn', () => {
    const state = TestBed.inject(MapState);
    state.adopt({ ...EMPTY, art: 'pfifferling', viewMode: 'ebene' });

    state.adopt({ ...EMPTY, art: 'trüffel', kw: 'KW40', viewMode: 'unsinn', layer: 'Regen!' });

    expect(state.art()).toBe('pfifferling');
    expect(state.viewMode()).toBe('ebene');
    expect(state.woche()).toBeNull();
    expect(state.layer()).toBeNull();
  });

  it('erkennt einen Link ohne eigene Werte', () => {
    expect(MapState.hasValues(EMPTY)).toBe(false);
    expect(MapState.hasValues({ ...EMPTY, art: 'pfifferling' })).toBe(true);
  });

  it('liest Regel und Faktoren aus einem Link und schreibt sie in den Speicher', async () => {
    const state = TestBed.inject(MapState);

    state.adopt({
      ...EMPTY,
      viewMode: 'kombination',
      rule: 'abgestuft',
      f: 'regen_4w:ge:80,temperatur:zw:8:16,!buche:ge:0.3',
    });
    TestBed.tick();
    await new Promise((done) => setTimeout(done, SAVE_DELAY + 30));

    expect(state.rule()).toBe('abgestuft');
    expect(state.factors()).toEqual([
      { source: 'regen_4w', condition: 'ueber', von: 80, bis: 0, active: true },
      { source: 'temperatur', condition: 'zwischen', von: 8, bis: 16, active: true },
      { source: 'buche', condition: 'ueber', von: 0.3, bis: 0, active: false },
    ]);
    expect(gesichert()['factors']).toBe('regen_4w:ge:80,temperatur:zw:8:16,!buche:ge:0.3');
    expect(gesichert()['rule']).toBe('abgestuft');
  });

  it('hält die Deckkraft zwischen null und voll und lässt Unsinn liegen', () => {
    const state = TestBed.inject(MapState);

    state.adopt({ ...EMPTY, opacity: '140' });
    expect(state.opacity()).toBe(1);

    state.adopt({ ...EMPTY, opacity: '-20' });
    expect(state.opacity()).toBe(0);

    state.adopt({ ...EMPTY, opacity: 'viel' });
    expect(state.opacity()).toBe(0);
  });

  it('nimmt nur einen Hintergrund an, den es schon gibt', () => {
    const state = TestBed.inject(MapState);

    state.setBackground('dunkel');
    expect(state.background()).toBe('dunkel');

    state.setBackground('satellit');
    expect(state.background()).toBe('dunkel');
  });

  it('steht nach einem Neuladen wieder da, wo er war', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        art: 'pfifferling',
        woche: '2025-39',
        viewMode: 'ebene',
        layer: 'wald',
        opacity: 0.4,
        rule: 'abgestuft',
        factors: 'wald:ge:0.3',
        background: 'dunkel',
        showMarkers: false,
      }),
    );

    const state = TestBed.inject(MapState);

    expect(state.art()).toBe('pfifferling');
    expect(state.woche()).toBe('2025-39');
    expect(state.viewMode()).toBe('ebene');
    expect(state.layer()).toBe('wald');
    expect(state.opacity()).toBeCloseTo(0.4);
    expect(state.rule()).toBe('abgestuft');
    expect(state.factors()).toHaveLength(1);
    expect(state.background()).toBe('dunkel');
    expect(state.showMarkers()).toBe(false);
  });

  it('fällt auf die Vorgaben zurück, wenn der Speicher kaputt ist', () => {
    localStorage.setItem(STORAGE_KEY, '{kein json');

    const state = TestBed.inject(MapState);

    expect(state.art()).toBe(DEFAULT_SPECIES);
    expect(state.viewMode()).toBe('vorhersage');
  });

  it('überliest einzelne Werte in falscher Form', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ art: 42, woche: 'gestern', opacity: 'viel', viewMode: 'ebene' }),
    );

    const state = TestBed.inject(MapState);

    expect(state.art()).toBe(DEFAULT_SPECIES);
    expect(state.woche()).toBeNull();
    expect(state.opacity()).toBe(1);
    expect(state.viewMode()).toBe('ebene');
  });

  it('liest und schreibt das offene Objekt in der Form der Adresse', () => {
    expect(readObject('fund:abc')).toEqual({ art: 'fund', id: 'abc' });
    expect(readObject('unsinn:abc')).toBeNull();
    expect(readObject('fund:')).toBeNull();
    expect(readObject(null)).toBeNull();
    expect(writeObject({ art: 'zone', id: 'z1' })).toBe('zone:z1');
  });
});
