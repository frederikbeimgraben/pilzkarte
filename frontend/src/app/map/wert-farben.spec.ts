import { VORHERSAGE_RAMPE } from '../ui/ramp/rampe-farben';
import { LUT_GROESSE, baueLut, faerbe, zuRgb } from './wert-farben';

describe('Wertfarben', () => {
  it('liest eine Farbe der Rampe', () => {
    expect(zuRgb('#0d0827')).toEqual([13, 8, 39]);
    expect(zuRgb('#fce79b')).toEqual([252, 231, 155]);
  });

  it('macht Byte 0 durchsichtig, denn es heißt „keine Daten“', () => {
    const lut = baueLut(0.5);

    expect(lut).toHaveLength(LUT_GROESSE);
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 0]);
  });

  it('beginnt bei Byte 1 am dunklen Ende der Rampe', () => {
    const lut = baueLut(0.5);
    const [r, g, b] = zuRgb(VORHERSAGE_RAMPE[0]);

    expect([lut[4], lut[5], lut[6]]).toEqual([r, g, b]);
  });

  it('läuft mit `top` über die Rampe: Byte 255 einer Art mit top 1 ist das helle Ende', () => {
    const voll = baueLut(1);
    const [r, g, b] = zuRgb(VORHERSAGE_RAMPE[VORHERSAGE_RAMPE.length - 1]);

    expect([voll[255 * 4], voll[255 * 4 + 1], voll[255 * 4 + 2]]).toEqual([r, g, b]);
  });

  it('hält eine schwache Art dunkel: top 0,2 kommt nie über die Mitte der Rampe', () => {
    const schwach = baueLut(0.2);
    const mitte = zuRgb(VORHERSAGE_RAMPE[4]);

    expect(schwach[255 * 4]).toBeLessThan(mitte[0]);
  });

  it('lässt die Deckkraft mit dem Wert steigen', () => {
    const lut = baueLut(0.5);

    expect(lut[4 + 3]).toBeLessThan(lut[128 * 4 + 3]);
    expect(lut[128 * 4 + 3]).toBeLessThan(lut[255 * 4 + 3]);
    expect(lut[255 * 4 + 3]).toBe(228);
  });

  it('färbt eine graue Kachel über die Tabelle', () => {
    const lut = baueLut(1);
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
});
