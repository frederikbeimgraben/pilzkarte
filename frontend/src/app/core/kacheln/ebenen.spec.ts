import {
  alsProzent,
  anteilErfuellt,
  einheitVon,
  formatiereZahl,
  histogrammFuer,
  leseHistogramm,
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
      histogramme: {
        '2025W39': { klassen: [0, 50, 151.9], anteile: [0.5, 0.5] },
        '2025W40': { klassen: [0, 50, 151.9], anteile: [0.8, 0.2] },
        kaputt: { klassen: [0, 1], anteile: [] },
      },
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
      histogramm: { klassen: [0, 0.5, 1], anteile: [0.7, 0.3] },
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
      histogramm: null,
      histogramme: new Map([
        ['2025W39', { klassen: [0, 50, 151.9], anteile: [0.5, 0.5] }],
        ['2025W40', { klassen: [0, 50, 151.9], anteile: [0.8, 0.2] }],
      ]),
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

  it('nimmt das Histogramm der Woche, bei einer festen Ebene das eine', () => {
    expect(histogrammFuer(REGEN, '2025W39')?.anteile).toEqual([0.5, 0.5]);
    expect(histogrammFuer(REGEN, '2026W10')?.anteile).toEqual([0.8, 0.2]);
    expect(histogrammFuer(WALD, '2025W39')?.anteile).toEqual([0.7, 0.3]);
    expect(histogrammFuer({ ...REGEN, histogramme: new Map() }, '2025W39')).toBeNull();
  });

  it('lässt ein Histogramm weg, dessen Kanten nicht zu den Anteilen passen', () => {
    expect(leseHistogramm({ klassen: [0, 1], anteile: [] })).toBeNull();
    expect(leseHistogramm({ klassen: [0, 1, 2], anteile: [0.5] })).toBeNull();
    expect(leseHistogramm(null)).toBeNull();
    expect(leseHistogramm({ klassen: [0, 1], anteile: [1] })).toEqual({ klassen: [0, 1], anteile: [1] });
  });

  it('rechnet den Anteil der Fläche, der eine Bedingung erfüllt', () => {
    const verteilung = { klassen: [0, 10, 20, 30], anteile: [0.5, 0.3, 0.2] };

    expect(anteilErfuellt(verteilung, 0, 30)).toBeCloseTo(1);
    expect(anteilErfuellt(verteilung, 10, 20)).toBeCloseTo(0.3);
    expect(anteilErfuellt(verteilung, 20, 30)).toBeCloseTo(0.2);
    // Eine halb getroffene Klasse zählt halb: gleichmäßig ist die ehrlichste Annahme.
    expect(anteilErfuellt(verteilung, 15, 20)).toBeCloseTo(0.15);
    expect(anteilErfuellt(verteilung, 5, 25)).toBeCloseTo(0.25 + 0.3 + 0.1);
    expect(anteilErfuellt(verteilung, 40, 50)).toBe(0);
    expect(anteilErfuellt(verteilung, -10, 100)).toBeCloseTo(1);
  });

  it('nennt die Einheit, auch wo ein Anteil als Prozent gilt', () => {
    expect(einheitVon(REGEN)).toBe('mm');
    expect(einheitVon(WALD)).toBe('%');
    expect(formatiereZahl(0.72, WALD, 'de')).toBe('72');
  });
});
