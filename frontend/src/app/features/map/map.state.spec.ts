import { TestBed } from '@angular/core/testing';
import { MapState, DEFAULT_SPECIES, DEFAULT_LAYER, readObject, writeObject } from './map.state';

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

describe('KartenZustand', () => {
  it('beginnt beim Steinpilz, der aktuellen Woche und der Vorhersage', () => {
    const state = TestBed.inject(MapState);

    expect(DEFAULT_SPECIES).toBe('boletus_edulis');
    expect(DEFAULT_LAYER).toBe('regen_4w');
    expect(state.adresse()).toEqual({
      art: 'boletus_edulis',
      kw: null,
      viewMode: 'vorhersage',
      layer: null,
      opacity: 100,
      rule: 'schnitt',
      f: 'regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3,hangneigung:le:15',
    });
  });

  it('übernimmt Art, Woche, Darstellung, Ebene und Deckkraft aus der Adresse', () => {
    const state = TestBed.inject(MapState);

    state.adopt({
      ...EMPTY,
      art: 'pfifferling',
      kw: '2025-40',
      viewMode: 'ebene',
      layer: 'regen_4w',
      opacity: '70',
    });

    expect(state.adresse()).toMatchObject({
      art: 'pfifferling',
      kw: '2025-40',
      viewMode: 'ebene',
      layer: 'regen_4w',
      opacity: 70,
    });
    expect(state.opacity()).toBeCloseTo(0.7);
  });

  it('fällt bei unbekannten Werten auf den Standard zurück', () => {
    const state = TestBed.inject(MapState);
    state.adopt({ ...EMPTY, art: 'pfifferling', kw: '2025-40', viewMode: 'ebene' });

    state.adopt({ ...EMPTY, art: 'trüffel', kw: 'KW40', viewMode: 'unsinn', layer: 'Regen 4W!' });

    expect(state.art()).toBe('boletus_edulis');
    expect(state.woche()).toBeNull();
    expect(state.viewMode()).toBe('vorhersage');
    expect(state.layer()).toBeNull();
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

  it('liest Regel und Faktoren aus der Adresse und schreibt sie zurück', () => {
    const state = TestBed.inject(MapState);

    state.adopt({
      ...EMPTY,
      viewMode: 'kombination',
      rule: 'abgestuft',
      f: 'regen_4w:ge:80,temperatur:zw:8:16,!buche:ge:0.3',
    });

    expect(state.rule()).toBe('abgestuft');
    expect(state.factors()).toEqual([
      { source: 'regen_4w', condition: 'ueber', von: 80, bis: 0, active: true },
      { source: 'temperatur', condition: 'zwischen', von: 8, bis: 16, active: true },
      { source: 'buche', condition: 'ueber', von: 0.3, bis: 0, active: false },
    ]);
    expect(state.adresse().f).toBe('regen_4w:ge:80,temperatur:zw:8:16,!buche:ge:0.3');
  });

  it('behält die vier Faktoren des Konzepts, wenn die Adresse keine nennt', () => {
    const state = TestBed.inject(MapState);
    state.adopt({ ...EMPTY, f: 'regen_4w:ge:80' });

    state.adopt({ ...EMPTY, f: 'unsinn' });

    expect(state.factors().map((factor) => factor.source)).toEqual([
      'regen_4w',
      'temperatur',
      'buche',
      'hangneigung',
    ]);
    expect(state.rule()).toBe('schnitt');
  });

  it('liest das offene Objekt aus der Adresse', () => {
    const state = TestBed.inject(MapState);

    state.adopt({ ...EMPTY, object: 'fund:abc' });

    expect(state.object()).toEqual({ art: 'fund', id: 'abc' });
  });

  it('zeigt Marker, Zonen und geteilte Funde ohne Zutun', () => {
    const state = TestBed.inject(MapState);

    expect(state.showMarkers()).toBe(true);
    expect(state.showZones()).toBe(true);
    expect(state.showSharedFinds()).toBe(true);
    expect(state.overlayHeight()).toBe(0);
  });
});

describe('Objekt in der Adresse', () => {
  it('liest jede der drei Arten', () => {
    expect(readObject('fund:eins')).toEqual({ art: 'fund', id: 'eins' });
    expect(readObject('marker:zwei')).toEqual({ art: 'marker', id: 'zwei' });
    expect(readObject('zone:drei')).toEqual({ art: 'zone', id: 'drei' });
  });

  it('nimmt alles andere als „nichts offen“', () => {
    expect(readObject(null)).toBeNull();
    expect(readObject('fund')).toBeNull();
    expect(readObject('fund:')).toBeNull();
    expect(readObject('baum:eins')).toBeNull();
  });

  it('schreibt dieselbe Form zurück', () => {
    expect(writeObject({ art: 'zone', id: 'drei' })).toBe('zone:drei');
  });
});
