import { leseEbenen, type Ebene } from '../../core/kacheln/ebenen';
import { RAND_ANTEIL } from '../../map/wert-farben';
import {
  STANDARD_FAKTOREN,
  bedingungText,
  byteFuerWert,
  ersetzeFaktor,
  grenzeFuer,
  kodiereFaktoren,
  kombiSchluessel,
  leseFaktoren,
  spanne,
  type Faktor,
} from './faktoren';

const REGEN = leseEbenen({
  layers: {
    regen_4w: { label: 'Regen', unit: 'mm', static: false, low: 0, high: 100, tiles: 'x' },
  },
}).ebenen[0];

const ANTEIL: Ebene = { ...REGEN, id: 'buche', label: 'Buche', einheit: '', low: 0, high: 1 };

const FAKTOR: Faktor = { quelle: 'regen_4w', bedingung: 'ueber', von: 80, bis: 0, aktiv: true };

describe('Faktoren', () => {
  it('kodiert die drei Formen der Bedingung', () => {
    expect(kodiereFaktoren(STANDARD_FAKTOREN)).toBe(
      'regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3,hangneigung:le:15',
    );
  });

  it('kennzeichnet einen abgehakten Faktor', () => {
    expect(kodiereFaktoren([{ ...FAKTOR, aktiv: false }])).toBe('!regen_4w:ge:80');
  });

  it('liest die Kodierung wieder ein', () => {
    expect(leseFaktoren(kodiereFaktoren(STANDARD_FAKTOREN))).toEqual(STANDARD_FAKTOREN);
    expect(leseFaktoren('!regen_4w:ge:80')).toEqual([{ ...FAKTOR, aktiv: false }]);
  });

  it('dreht eine verkehrte Spanne um und lässt Unsinn weg', () => {
    expect(leseFaktoren('temperatur:zw:16:8')).toEqual([
      { quelle: 'temperatur', bedingung: 'zwischen', von: 8, bis: 16, aktiv: true },
    ]);
    expect(leseFaktoren('regen_4w:xx:80,Regen!:ge:1,temperatur:zw:8')).toEqual([]);
    expect(leseFaktoren(null)).toEqual([]);
    expect(leseFaktoren('')).toEqual([]);
  });

  it('macht aus jeder Bedingung eine Spanne über der Skala', () => {
    expect(spanne(FAKTOR, REGEN)).toEqual({ von: 80, bis: 100 });
    expect(spanne({ ...FAKTOR, bedingung: 'unter', bis: 15 }, REGEN)).toEqual({ von: 0, bis: 15 });
    expect(spanne({ ...FAKTOR, bedingung: 'zwischen', von: 8, bis: 16 }, REGEN)).toEqual({
      von: 8,
      bis: 16,
    });
  });

  it('schreibt die Bedingung mit Einheit', () => {
    expect(bedingungText(FAKTOR, REGEN, 'de', 'bis')).toBe('≥ 80 mm');
    expect(bedingungText({ ...FAKTOR, bedingung: 'unter', bis: 15 }, REGEN, 'de', 'bis')).toBe('≤ 15 mm');
    expect(bedingungText({ ...FAKTOR, bedingung: 'zwischen', von: 8, bis: 16 }, REGEN, 'de', 'bis')).toBe(
      '8 bis 16 mm',
    );
    expect(bedingungText({ ...FAKTOR, quelle: 'buche', von: 0.3 }, ANTEIL, 'de', 'bis')).toBe('≥ 30 %');
  });

  it('rechnet einen Wert in das Byte der Kachel', () => {
    expect(byteFuerWert(REGEN, 0)).toBe(1);
    expect(byteFuerWert(REGEN, 100)).toBe(255);
    expect(byteFuerWert(REGEN, 50)).toBe(128);
    expect(byteFuerWert(REGEN, -20)).toBe(1);
    expect(byteFuerWert(REGEN, 500)).toBe(255);
  });

  it('gibt dem Worker die Bedingung in Bytes samt Randbreite', () => {
    expect(grenzeFuer(FAKTOR, REGEN)).toEqual({
      von: byteFuerWert(REGEN, 80),
      bis: 255,
      rand: Math.round(254 * RAND_ANTEIL),
    });
  });

  it('hält je Quelle genau einen Faktor', () => {
    const zweiter: Faktor = { ...FAKTOR, von: 40 };

    expect(ersetzeFaktor(STANDARD_FAKTOREN, zweiter)[0].von).toBe(40);
    expect(ersetzeFaktor(STANDARD_FAKTOREN, zweiter)).toHaveLength(STANDARD_FAKTOREN.length);
    expect(ersetzeFaktor(STANDARD_FAKTOREN, { ...FAKTOR, quelle: 'hoehe' })).toHaveLength(
      STANDARD_FAKTOREN.length + 1,
    );
  });

  it('gibt jeder Kombination einen eigenen Schlüssel', () => {
    expect(kombiSchluessel(['schnitt', 'a'])).toHaveLength(8);
    expect(kombiSchluessel(['schnitt', 'a'])).toBe(kombiSchluessel(['schnitt', 'a']));
    expect(kombiSchluessel(['schnitt', 'a'])).not.toBe(kombiSchluessel(['abgestuft', 'a']));
  });
});
