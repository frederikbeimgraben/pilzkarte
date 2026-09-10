import { VORHERSAGE_RAMPE } from '../ui/ramp/rampe-farben';
import {
  LEERER_PUNKT,
  LUT_GROESSE,
  SCHNITT_DECKKRAFT,
  baueKombiLut,
  baueLut,
  erfuellungsgrad,
  faerbe,
  kombiIndex,
  kombiniere,
  werteByte,
  zuRgb,
} from './wert-farben';

describe('Wertfarben', () => {
  it('liest eine Farbe der Rampe', () => {
    expect(zuRgb('#0d0827')).toEqual([13, 8, 39]);
    expect(zuRgb('#fce79b')).toEqual([252, 231, 155]);
  });

  it('macht Byte 0 durchsichtig, denn es heißt „keine Daten“', () => {
    const lut = baueLut({ art: 'wahrscheinlichkeit', top: 0.5 });

    expect(lut).toHaveLength(LUT_GROESSE);
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 0]);
  });

  it('beginnt bei Byte 1 am dunklen Ende der Rampe', () => {
    const lut = baueLut({ art: 'wahrscheinlichkeit', top: 0.5 });
    const [r, g, b] = zuRgb(VORHERSAGE_RAMPE[0]);

    expect([lut[4], lut[5], lut[6]]).toEqual([r, g, b]);
  });

  it('läuft mit `top` über die Rampe: Byte 255 einer Art mit top 1 ist das helle Ende', () => {
    const voll = baueLut({ art: 'wahrscheinlichkeit', top: 1 });
    const [r, g, b] = zuRgb(VORHERSAGE_RAMPE[VORHERSAGE_RAMPE.length - 1]);

    expect([voll[255 * 4], voll[255 * 4 + 1], voll[255 * 4 + 2]]).toEqual([r, g, b]);
  });

  it('hält eine schwache Art dunkel: top 0,2 kommt nie über die Mitte der Rampe', () => {
    const schwach = baueLut({ art: 'wahrscheinlichkeit', top: 0.2 });
    const mitte = zuRgb(VORHERSAGE_RAMPE[4]);

    expect(schwach[255 * 4]).toBeLessThan(mitte[0]);
  });

  it('lässt die Deckkraft mit dem Wert steigen', () => {
    const lut = baueLut({ art: 'wahrscheinlichkeit', top: 0.5 });

    expect(lut[4 + 3]).toBeLessThan(lut[128 * 4 + 3]);
    expect(lut[128 * 4 + 3]).toBeLessThan(lut[255 * 4 + 3]);
    expect(lut[255 * 4 + 3]).toBe(228);
  });

  it('färbt eine graue Kachel über die Tabelle', () => {
    const lut = baueLut({ art: 'wahrscheinlichkeit', top: 1 });
    const punkte = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);

    faerbe(punkte, lut);

    expect([punkte[0], punkte[1], punkte[2], punkte[3]]).toEqual([0, 0, 0, 0]);
    expect([punkte[4], punkte[5], punkte[6], punkte[7]]).toEqual([
      lut[255 * 4],
      lut[255 * 4 + 1],
      lut[255 * 4 + 2],
      lut[255 * 4 + 3],
    ]);
  });

  it('spannt eine Ebene über die ganze Rampe und lässt sie gleich deckend', () => {
    const lut = baueLut({ art: 'spanne', low: 4.7, high: 6.9 });
    const dunkel = zuRgb(VORHERSAGE_RAMPE[0]);
    const hell = zuRgb(VORHERSAGE_RAMPE[VORHERSAGE_RAMPE.length - 1]);

    expect([lut[4], lut[5], lut[6]]).toEqual(dunkel);
    expect([lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2]]).toEqual(hell);
    expect(lut[4 + 3]).toBe(215);
    expect(lut[255 * 4 + 3]).toBe(215);
    expect(lut[3]).toBe(0);
  });

  it('rechnet ein Byte in den Wert der Quelle zurück', () => {
    expect(werteByte({ art: 'wahrscheinlichkeit', top: 0.5 }, 255)).toBeCloseTo(0.5);
    expect(werteByte({ art: 'spanne', low: 4.7, high: 6.9 }, 1)).toBeCloseTo(4.7);
    expect(werteByte({ art: 'spanne', low: 4.7, high: 6.9 }, 255)).toBeCloseTo(6.9);
  });

  it('gibt vollen Grad innerhalb der Bedingung und fällt über den Rand ab', () => {
    const grenze = { von: 100, bis: 200, rand: 25 };

    expect(erfuellungsgrad(150, grenze)).toBe(1);
    expect(erfuellungsgrad(100, grenze)).toBe(1);
    expect(erfuellungsgrad(200, grenze)).toBe(1);
    expect(erfuellungsgrad(212, grenze)).toBeCloseTo(0.52);
    expect(erfuellungsgrad(88, grenze)).toBeCloseTo(0.52);
    expect(erfuellungsgrad(230, grenze)).toBe(0);
  });

  it('kennt ohne Rand nur ganz oder gar nicht', () => {
    expect(erfuellungsgrad(90, { von: 100, bis: 200, rand: 0 })).toBe(0);
  });

  it('färbt die Schnittmenge nur, wo jede Bedingung zutrifft', () => {
    const grenzen = [
      { von: 100, bis: 200, rand: 25 },
      { von: 50, bis: 255, rand: 25 },
    ];

    expect(kombiniere([150, 200], grenzen, 'schnitt')).toBe(1);
    expect(kombiniere([210, 200], grenzen, 'schnitt')).toBe(0);
  });

  it('nimmt abgestuft das geometrische Mittel der Grade', () => {
    const grenzen = [
      { von: 100, bis: 200, rand: 25 },
      { von: 100, bis: 200, rand: 25 },
    ];

    expect(kombiniere([150, 150], grenzen, 'abgestuft')).toBe(1);
    // Ein Faktor bei 0,52, einer bei 1: das geometrische Mittel ist die Wurzel.
    expect(kombiniere([212, 150], grenzen, 'abgestuft')).toBeCloseTo(Math.sqrt(0.52), 2);
    expect(kombiniere([230, 150], grenzen, 'abgestuft')).toBe(0);
  });

  it('lässt einen Punkt leer, sobald einer Quelle die Daten fehlen', () => {
    const grenzen = [
      { von: 1, bis: 255, rand: 25 },
      { von: 1, bis: 255, rand: 25 },
    ];

    expect(kombiniere([150, 0], grenzen, 'schnitt')).toBe(LEERER_PUNKT);
    expect(kombiniere([0, 150], grenzen, 'abgestuft')).toBe(LEERER_PUNKT);
    expect(kombiniere([], [], 'schnitt')).toBe(LEERER_PUNKT);
  });

  it('malt die Schnittmenge in einer Farbe, halb deckend', () => {
    const lut = baueKombiLut(['#004225'], 'schnitt');
    const [r, g, b] = zuRgb('#004225');

    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 0]);
    expect([lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2], lut[255 * 4 + 3]]).toEqual([
      r,
      g,
      b,
      SCHNITT_DECKKRAFT,
    ]);
  });

  it('malt abgestuft über die ganze Rampe, mit der Deckkraft am Wert', () => {
    const lut = baueKombiLut(VORHERSAGE_RAMPE, 'abgestuft');

    expect([lut[4], lut[5], lut[6]]).toEqual(zuRgb(VORHERSAGE_RAMPE[0]));
    expect([lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2]]).toEqual(
      zuRgb(VORHERSAGE_RAMPE[VORHERSAGE_RAMPE.length - 1]),
    );
    expect(lut[4 + 3]).toBeLessThan(lut[255 * 4 + 3]);
  });

  it('trifft mit dem Ergebnis den Eintrag der Tabelle', () => {
    expect(kombiIndex(0)).toBe(0);
    expect(kombiIndex(-1)).toBe(0);
    expect(kombiIndex(1)).toBe(255);
    expect(kombiIndex(0.5)).toBe(128);
  });
});
