import {
  alsProzent,
  ebenenGruppen,
  ebenenOrdner,
  ebenenWoche,
  findeEbene,
  formatiereWert,
  leseEbenen,
  passendeWoche,
} from './ebenen';

const ROH = {
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  layers: {
    regen_4w: {
      label: 'Niederschlag der letzten 4 Wochen',
      unit: 'mm',
      static: false,
      low: 0,
      high: 151.9,
      weeks: ['2025W39', '2025W40'],
      tiles: 'layers_kacheln/regen_4w',
      zooms: [5, 7],
      have: { '7': ['66/42'] },
    },
    wald: {
      label: 'Waldanteil',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/wald',
      zooms: [5, 8],
      have: { '8': ['132/82'] },
    },
    kaputt: { label: 'Ohne Kacheln' },
  },
};

const MANIFEST = leseEbenen(ROH);
const REGEN = MANIFEST.ebenen[0];
const WALD = MANIFEST.ebenen[1];

describe('Ebenen', () => {
  it('liest Grenzen, Spanne, Wochen und die vorhandenen Kacheln', () => {
    expect(MANIFEST.grenzen).toEqual([
      [4.93, 47.14],
      [15.14, 55.25],
    ]);
    expect(REGEN).toEqual({
      id: 'regen_4w',
      label: 'Niederschlag der letzten 4 Wochen',
      einheit: 'mm',
      fest: false,
      low: 0,
      high: 151.9,
      kachelPfad: 'layers_kacheln/regen_4w',
      zoomVon: 5,
      zoomBis: 7,
      vorhanden: new Set(['7/66/42']),
      wochen: ['2025W39', '2025W40'],
    });
  });

  it('lässt eine Ebene ohne Kachelordner weg', () => {
    expect(MANIFEST.ebenen.map((ebene) => ebene.id)).toEqual(['regen_4w', 'wald']);
  });

  it('macht aus einem leeren Manifest eine leere Liste', () => {
    expect(leseEbenen(null).ebenen).toEqual([]);
  });

  it('teilt in Wochenebenen und feste', () => {
    const { jeWoche, fest } = ebenenGruppen(MANIFEST.ebenen);

    expect(jeWoche.map((ebene) => ebene.id)).toEqual(['regen_4w']);
    expect(fest.map((ebene) => ebene.id)).toEqual(['wald']);
  });

  it('schreibt den Wochenschlüssel wie das Rendering', () => {
    expect(ebenenWoche(2026, 7)).toBe('2026W07');
  });

  it('nimmt die jüngste Woche, die die Ebene hat', () => {
    expect(passendeWoche(REGEN, '2025W40')).toBe('2025W40');
    expect(passendeWoche(REGEN, '2026W10')).toBe('2025W40');
    expect(passendeWoche(REGEN, '2024W01')).toBe('2025W39');
    expect(passendeWoche(REGEN, null)).toBe('2025W40');
    expect(passendeWoche(WALD, '2025W40')).toBeNull();
  });

  it('baut den Kachelordner mit und ohne Woche', () => {
    expect(ebenenOrdner(REGEN, '2025W39')).toBe('layers_kacheln/regen_4w/2025W39');
    expect(ebenenOrdner(WALD, '2025W39')).toBe('layers_kacheln/wald');
  });

  it('findet eine Ebene über ihre Kennung', () => {
    expect(findeEbene(MANIFEST, 'wald')?.label).toBe('Waldanteil');
    expect(findeEbene(MANIFEST, 'gibtesnicht')).toBeNull();
    expect(findeEbene(null, 'wald')).toBeNull();
    expect(findeEbene(MANIFEST, null)).toBeNull();
  });

  it('liest einen Anteil als Prozent, einen pH-Wert nicht', () => {
    const ph = leseEbenen({
      layers: {
        boden_ph: { label: 'Boden-pH', unit: '', static: true, low: 4.663, high: 6.899, tiles: 'x' },
      },
    }).ebenen[0];

    expect(alsProzent(WALD)).toBe(true);
    expect(alsProzent(ph)).toBe(false);
    expect(formatiereWert(0.72, WALD, 'de')).toBe('72 %');
    expect(formatiereWert(4.663, ph, 'de')).toBe('4,7');
  });

  it('nennt die Einheit und rundet grobe Zahlen', () => {
    expect(formatiereWert(0, REGEN, 'de')).toBe('0 mm');
    expect(formatiereWert(151.9, REGEN, 'de')).toBe('152 mm');
    expect(formatiereWert(12.34, REGEN, 'de')).toBe('12,3 mm');
    expect(formatiereWert(151.9, REGEN, 'en')).toBe('152 mm');
  });
});
