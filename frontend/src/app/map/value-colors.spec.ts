import { FORECAST_RAMP } from '../ui/ramp/ramp-colors';
import {
  EMPTY_DOT,
  LUT_SIZE,
  INTERSECTION_OPACITY,
  createCombinationLut,
  createLut,
  fulfilment,
  colorize,
  combinationIndex,
  combine,
  valueBytes,
  zuRgb,
} from './value-colors';

describe('Wertfarben', () => {
  it('liest eine Farbe der Rampe', () => {
    expect(zuRgb('#0d0827')).toEqual([13, 8, 39]);
    expect(zuRgb('#fce79b')).toEqual([252, 231, 155]);
  });

  it('macht Byte 0 durchsichtig, denn es heißt „keine Daten“', () => {
    const lut = createLut({ art: 'wahrscheinlichkeit', top: 0.5 });

    expect(lut).toHaveLength(LUT_SIZE);
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 0]);
  });

  it('beginnt bei Byte 1 am dunklen Ende der Rampe', () => {
    const lut = createLut({ art: 'wahrscheinlichkeit', top: 0.5 });
    const [r, g, b] = zuRgb(FORECAST_RAMP[0]);

    expect([lut[4], lut[5], lut[6]]).toEqual([r, g, b]);
  });

  it('läuft mit `top` über die Rampe: Byte 255 einer Art mit top 1 ist das helle Ende', () => {
    const full = createLut({ art: 'wahrscheinlichkeit', top: 1 });
    const [r, g, b] = zuRgb(FORECAST_RAMP[FORECAST_RAMP.length - 1]);

    expect([full[255 * 4], full[255 * 4 + 1], full[255 * 4 + 2]]).toEqual([r, g, b]);
  });

  it('hält eine schwache Art dunkel: top 0,2 kommt nie über die Mitte der Rampe', () => {
    const weak = createLut({ art: 'wahrscheinlichkeit', top: 0.2 });
    const center = zuRgb(FORECAST_RAMP[4]);

    expect(weak[255 * 4]).toBeLessThan(center[0]);
  });

  it('lässt die Deckkraft mit dem Wert steigen', () => {
    const lut = createLut({ art: 'wahrscheinlichkeit', top: 0.5 });

    expect(lut[4 + 3]).toBeLessThan(lut[128 * 4 + 3]);
    expect(lut[128 * 4 + 3]).toBeLessThan(lut[255 * 4 + 3]);
    expect(lut[255 * 4 + 3]).toBe(228);
  });

  it('färbt eine graue Kachel über die Tabelle', () => {
    const lut = createLut({ art: 'wahrscheinlichkeit', top: 1 });
    const punkte = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);

    colorize(punkte, lut);

    expect([punkte[0], punkte[1], punkte[2], punkte[3]]).toEqual([0, 0, 0, 0]);
    expect([punkte[4], punkte[5], punkte[6], punkte[7]]).toEqual([
      lut[255 * 4],
      lut[255 * 4 + 1],
      lut[255 * 4 + 2],
      lut[255 * 4 + 3],
    ]);
  });

  it('spannt eine Ebene über die ganze Rampe und lässt sie gleich deckend', () => {
    const lut = createLut({ art: 'spanne', low: 4.7, high: 6.9 });
    const dark = zuRgb(FORECAST_RAMP[0]);
    const light = zuRgb(FORECAST_RAMP[FORECAST_RAMP.length - 1]);

    expect([lut[4], lut[5], lut[6]]).toEqual(dark);
    expect([lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2]]).toEqual(light);
    expect(lut[4 + 3]).toBe(215);
    expect(lut[255 * 4 + 3]).toBe(215);
    expect(lut[3]).toBe(0);
  });

  it('rechnet ein Byte in den Wert der Quelle zurück', () => {
    expect(valueBytes({ art: 'wahrscheinlichkeit', top: 0.5 }, 255)).toBeCloseTo(0.5);
    expect(valueBytes({ art: 'spanne', low: 4.7, high: 6.9 }, 1)).toBeCloseTo(4.7);
    expect(valueBytes({ art: 'spanne', low: 4.7, high: 6.9 }, 255)).toBeCloseTo(6.9);
  });

  it('gibt vollen Grad innerhalb der Bedingung und fällt über den Rand ab', () => {
    const bound = { von: 100, bis: 200, edge: 25 };

    expect(fulfilment(150, bound)).toBe(1);
    expect(fulfilment(100, bound)).toBe(1);
    expect(fulfilment(200, bound)).toBe(1);
    expect(fulfilment(212, bound)).toBeCloseTo(0.52);
    expect(fulfilment(88, bound)).toBeCloseTo(0.52);
    expect(fulfilment(230, bound)).toBe(0);
  });

  it('kennt ohne Rand nur ganz oder gar nicht', () => {
    expect(fulfilment(90, { von: 100, bis: 200, edge: 0 })).toBe(0);
  });

  it('färbt die Schnittmenge nur, wo jede Bedingung zutrifft', () => {
    const bounds = [
      { von: 100, bis: 200, edge: 25 },
      { von: 50, bis: 255, edge: 25 },
    ];

    expect(combine([150, 200], bounds, 'schnitt')).toBe(1);
    expect(combine([210, 200], bounds, 'schnitt')).toBe(0);
  });

  it('nimmt abgestuft das geometrische Mittel der Grade', () => {
    const bounds = [
      { von: 100, bis: 200, edge: 25 },
      { von: 100, bis: 200, edge: 25 },
    ];

    expect(combine([150, 150], bounds, 'abgestuft')).toBe(1);
    // Ein Faktor bei 0,52, einer bei 1: das geometrische Mittel ist die Wurzel.
    expect(combine([212, 150], bounds, 'abgestuft')).toBeCloseTo(Math.sqrt(0.52), 2);
    expect(combine([230, 150], bounds, 'abgestuft')).toBe(0);
  });

  it('lässt einen Punkt leer, sobald einer Quelle die Daten fehlen', () => {
    const bounds = [
      { von: 1, bis: 255, edge: 25 },
      { von: 1, bis: 255, edge: 25 },
    ];

    expect(combine([150, 0], bounds, 'schnitt')).toBe(EMPTY_DOT);
    expect(combine([0, 150], bounds, 'abgestuft')).toBe(EMPTY_DOT);
    expect(combine([], [], 'schnitt')).toBe(EMPTY_DOT);
  });

  it('malt die Schnittmenge in einer Farbe, halb deckend', () => {
    const lut = createCombinationLut(['#004225'], 'schnitt');
    const [r, g, b] = zuRgb('#004225');

    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 0]);
    expect([lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2], lut[255 * 4 + 3]]).toEqual([
      r,
      g,
      b,
      INTERSECTION_OPACITY,
    ]);
  });

  it('malt abgestuft über die ganze Rampe, mit der Deckkraft am Wert', () => {
    const lut = createCombinationLut(FORECAST_RAMP, 'abgestuft');

    expect([lut[4], lut[5], lut[6]]).toEqual(zuRgb(FORECAST_RAMP[0]));
    expect([lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2]]).toEqual(
      zuRgb(FORECAST_RAMP[FORECAST_RAMP.length - 1]),
    );
    expect(lut[4 + 3]).toBeLessThan(lut[255 * 4 + 3]);
  });

  it('trifft mit dem Ergebnis den Eintrag der Tabelle', () => {
    expect(combinationIndex(0)).toBe(0);
    expect(combinationIndex(-1)).toBe(0);
    expect(combinationIndex(1)).toBe(255);
    expect(combinationIndex(0.5)).toBe(128);
  });
});
