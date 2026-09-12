import { readLayers, type Layer } from '../../core/tiles/layers';
import { EDGE_SHARE } from '../../map/value-colors';
import {
  conditionText,
  byteForValue,
  replaceFactor,
  boundFor,
  encodeFactors,
  combinationKey,
  readFactors,
  span,
  type Faktor,
} from './factors';

const RAIN = readLayers({
  layers: {
    regen_4w: { label: 'Regen', unit: 'mm', static: false, low: 0, high: 100, tiles: 'x' },
  },
}).layers[0];

const SHARE_LAYER: Layer = { ...RAIN, id: 'buche', label: 'Buche', unit: '', low: 0, high: 1 };

const FAKTOR: Faktor = { source: 'regen_4w', condition: 'ueber', von: 80, bis: 0, active: true };

/** Das Beispiel aus dem Konzept, als Prüfstein für Kodierung und Lesen. */
const VIER: readonly Faktor[] = [
  FAKTOR,
  { source: 'temperatur', condition: 'zwischen', von: 8, bis: 16, active: true },
  { source: 'buche', condition: 'ueber', von: 0.3, bis: 0, active: true },
  { source: 'hangneigung', condition: 'unter', von: 0, bis: 15, active: true },
];

describe('Faktoren', () => {
  it('kodiert die drei Formen der Bedingung', () => {
    expect(encodeFactors(VIER)).toBe('regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3,hangneigung:le:15');
  });

  it('kennzeichnet einen abgehakten Faktor', () => {
    expect(encodeFactors([{ ...FAKTOR, active: false }])).toBe('!regen_4w:ge:80');
  });

  it('liest die Kodierung wieder ein', () => {
    expect(readFactors(encodeFactors(VIER))).toEqual(VIER);
    expect(readFactors('!regen_4w:ge:80')).toEqual([{ ...FAKTOR, active: false }]);
  });

  it('dreht eine verkehrte Spanne um und lässt Unsinn weg', () => {
    expect(readFactors('temperatur:zw:16:8')).toEqual([
      { source: 'temperatur', condition: 'zwischen', von: 8, bis: 16, active: true },
    ]);
    expect(readFactors('regen_4w:xx:80,Regen!:ge:1,temperatur:zw:8')).toEqual([]);
    expect(readFactors(null)).toEqual([]);
    expect(readFactors('')).toEqual([]);
  });

  it('macht aus jeder Bedingung eine Spanne über der Skala', () => {
    expect(span(FAKTOR, RAIN)).toEqual({ von: 80, bis: 100 });
    expect(span({ ...FAKTOR, condition: 'unter', bis: 15 }, RAIN)).toEqual({ von: 0, bis: 15 });
    expect(span({ ...FAKTOR, condition: 'zwischen', von: 8, bis: 16 }, RAIN)).toEqual({
      von: 8,
      bis: 16,
    });
  });

  it('schreibt die Bedingung mit Einheit', () => {
    expect(conditionText(FAKTOR, RAIN, 'de', 'bis')).toBe('≥ 80 mm');
    expect(conditionText({ ...FAKTOR, condition: 'unter', bis: 15 }, RAIN, 'de', 'bis')).toBe('≤ 15 mm');
    expect(conditionText({ ...FAKTOR, condition: 'zwischen', von: 8, bis: 16 }, RAIN, 'de', 'bis')).toBe(
      '8 bis 16 mm',
    );
    expect(conditionText({ ...FAKTOR, source: 'buche', von: 0.3 }, SHARE_LAYER, 'de', 'bis')).toBe('≥ 30 %');
  });

  it('rechnet einen Wert in das Byte der Kachel', () => {
    expect(byteForValue(RAIN, 0)).toBe(1);
    expect(byteForValue(RAIN, 100)).toBe(255);
    expect(byteForValue(RAIN, 50)).toBe(128);
    expect(byteForValue(RAIN, -20)).toBe(1);
    expect(byteForValue(RAIN, 500)).toBe(255);
  });

  it('gibt dem Worker die Bedingung in Bytes samt Randbreite', () => {
    expect(boundFor(FAKTOR, RAIN)).toEqual({
      von: byteForValue(RAIN, 80),
      bis: 255,
      edge: Math.round(254 * EDGE_SHARE),
    });
  });

  it('hält je Quelle genau einen Faktor', () => {
    const second: Faktor = { ...FAKTOR, von: 40 };

    expect(replaceFactor(VIER, second)[0].von).toBe(40);
    expect(replaceFactor(VIER, second)).toHaveLength(VIER.length);
    expect(replaceFactor(VIER, { ...FAKTOR, source: 'hoehe' })).toHaveLength(VIER.length + 1);
  });

  it('gibt jeder Kombination einen eigenen Schlüssel', () => {
    expect(combinationKey(['schnitt', 'a'])).toHaveLength(8);
    expect(combinationKey(['schnitt', 'a'])).toBe(combinationKey(['schnitt', 'a']));
    expect(combinationKey(['schnitt', 'a'])).not.toBe(combinationKey(['abgestuft', 'a']));
  });
});
