import { TestBed } from '@angular/core/testing';
import { KartenZustand, STANDARD_ART, STANDARD_EBENE, leseObjekt, schreibeObjekt } from './karten-zustand';

const LEER = {
  art: null,
  kw: null,
  darstellung: null,
  ebene: null,
  deckkraft: null,
  regel: null,
  f: null,
  objekt: null,
};

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
      regel: 'schnitt',
      f: 'regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3,hangneigung:le:15',
    });
  });

  it('übernimmt Art, Woche, Darstellung, Ebene und Deckkraft aus der Adresse', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm({
      ...LEER,
      art: 'pfifferling',
      kw: '2025-40',
      darstellung: 'ebene',
      ebene: 'regen_4w',
      deckkraft: '70',
    });

    expect(zustand.adresse()).toMatchObject({
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

  it('liest Regel und Faktoren aus der Adresse und schreibt sie zurück', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm({
      ...LEER,
      darstellung: 'kombination',
      regel: 'abgestuft',
      f: 'regen_4w:ge:80,temperatur:zw:8:16,!buche:ge:0.3',
    });

    expect(zustand.regel()).toBe('abgestuft');
    expect(zustand.faktoren()).toEqual([
      { quelle: 'regen_4w', bedingung: 'ueber', von: 80, bis: 0, aktiv: true },
      { quelle: 'temperatur', bedingung: 'zwischen', von: 8, bis: 16, aktiv: true },
      { quelle: 'buche', bedingung: 'ueber', von: 0.3, bis: 0, aktiv: false },
    ]);
    expect(zustand.adresse().f).toBe('regen_4w:ge:80,temperatur:zw:8:16,!buche:ge:0.3');
  });

  it('behält die vier Faktoren des Konzepts, wenn die Adresse keine nennt', () => {
    const zustand = TestBed.inject(KartenZustand);
    zustand.uebernimm({ ...LEER, f: 'regen_4w:ge:80' });

    zustand.uebernimm({ ...LEER, f: 'unsinn' });

    expect(zustand.faktoren().map((faktor) => faktor.quelle)).toEqual([
      'regen_4w',
      'temperatur',
      'buche',
      'hangneigung',
    ]);
    expect(zustand.regel()).toBe('schnitt');
  });

  it('liest das offene Objekt aus der Adresse', () => {
    const zustand = TestBed.inject(KartenZustand);

    zustand.uebernimm({ ...LEER, objekt: 'fund:abc' });

    expect(zustand.objekt()).toEqual({ art: 'fund', id: 'abc' });
  });

  it('zeigt Marker, Zonen und geteilte Funde ohne Zutun', () => {
    const zustand = TestBed.inject(KartenZustand);

    expect(zustand.zeigeMarker()).toBe(true);
    expect(zustand.zeigeZonen()).toBe(true);
    expect(zustand.zeigeGeteilteFunde()).toBe(true);
    expect(zustand.ueberlagerung()).toBe(0);
  });
});

describe('Objekt in der Adresse', () => {
  it('liest jede der drei Arten', () => {
    expect(leseObjekt('fund:eins')).toEqual({ art: 'fund', id: 'eins' });
    expect(leseObjekt('marker:zwei')).toEqual({ art: 'marker', id: 'zwei' });
    expect(leseObjekt('zone:drei')).toEqual({ art: 'zone', id: 'drei' });
  });

  it('nimmt alles andere als „nichts offen“', () => {
    expect(leseObjekt(null)).toBeNull();
    expect(leseObjekt('fund')).toBeNull();
    expect(leseObjekt('fund:')).toBeNull();
    expect(leseObjekt('baum:eins')).toBeNull();
  });

  it('schreibt dieselbe Form zurück', () => {
    expect(schreibeObjekt({ art: 'zone', id: 'drei' })).toBe('zone:drei');
  });
});
