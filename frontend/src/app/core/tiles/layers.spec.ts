import {
  asPercent,
  shareMet,
  unitOf,
  formatNumber,
  histogramFor,
  readHistogram,
  layerGroups,
  layerFolders,
  layerWeek,
  findLayer,
  formatValue,
  readLayers,
  matchingWeek,
} from './layers';

const RAW = {
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
        broken: { klassen: [0, 1], anteile: [] },
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
    broken: { label: 'Ohne Kacheln' },
  },
};

const MANIFEST = readLayers(RAW);
const RAIN = MANIFEST.layers[0];
const FOREST = MANIFEST.layers[1];

describe('Ebenen', () => {
  it('liest Grenzen, Spanne, Wochen und die vorhandenen Kacheln', () => {
    expect(MANIFEST.bounds).toEqual([
      [4.93, 47.14],
      [15.14, 55.25],
    ]);
    expect(RAIN).toEqual({
      id: 'regen_4w',
      label: 'Niederschlag der letzten 4 Wochen',
      unit: 'mm',
      fixed: false,
      low: 0,
      high: 151.9,
      tilePath: 'layers_kacheln/regen_4w',
      zoomVon: 5,
      zoomBis: 7,
      existing: new Set(['7/66/42']),
      wochen: ['2025W39', '2025W40'],
      histogramm: null,
      histogramme: new Map([
        ['2025W39', { klassen: [0, 50, 151.9], anteile: [0.5, 0.5] }],
        ['2025W40', { klassen: [0, 50, 151.9], anteile: [0.8, 0.2] }],
      ]),
    });
  });

  it('lässt eine Ebene ohne Kachelordner weg', () => {
    expect(MANIFEST.layers.map((layer) => layer.id)).toEqual(['regen_4w', 'wald']);
  });

  it('macht aus einem leeren Manifest eine leere Liste', () => {
    expect(readLayers(null).layers).toEqual([]);
  });

  it('teilt in Wochenebenen und feste', () => {
    const { perWeek, fixed } = layerGroups(MANIFEST.layers);

    expect(perWeek.map((layer) => layer.id)).toEqual(['regen_4w']);
    expect(fixed.map((layer) => layer.id)).toEqual(['wald']);
  });

  it('schreibt den Wochenschlüssel wie das Rendering', () => {
    expect(layerWeek(2026, 7)).toBe('2026W07');
  });

  it('nimmt die jüngste Woche, die die Ebene hat', () => {
    expect(matchingWeek(RAIN, '2025W40')).toBe('2025W40');
    expect(matchingWeek(RAIN, '2026W10')).toBe('2025W40');
    expect(matchingWeek(RAIN, '2024W01')).toBe('2025W39');
    expect(matchingWeek(RAIN, null)).toBe('2025W40');
    expect(matchingWeek(FOREST, '2025W40')).toBeNull();
  });

  it('baut den Kachelordner mit und ohne Woche', () => {
    expect(layerFolders(RAIN, '2025W39')).toBe('layers_kacheln/regen_4w/2025W39');
    expect(layerFolders(FOREST, '2025W39')).toBe('layers_kacheln/wald');
  });

  it('findet eine Ebene über ihre Kennung', () => {
    expect(findLayer(MANIFEST, 'wald')?.label).toBe('Waldanteil');
    expect(findLayer(MANIFEST, 'gibtesnicht')).toBeNull();
    expect(findLayer(null, 'wald')).toBeNull();
    expect(findLayer(MANIFEST, null)).toBeNull();
  });

  it('liest einen Anteil als Prozent, einen pH-Wert nicht', () => {
    const ph = readLayers({
      layers: {
        boden_ph: { label: 'Boden-pH', unit: '', static: true, low: 4.663, high: 6.899, tiles: 'x' },
      },
    }).layers[0];

    expect(asPercent(FOREST)).toBe(true);
    expect(asPercent(ph)).toBe(false);
    expect(formatValue(0.72, FOREST, 'de')).toBe('72 %');
    expect(formatValue(4.663, ph, 'de')).toBe('4,7');
  });

  it('nennt die Einheit und rundet grobe Zahlen', () => {
    expect(formatValue(0, RAIN, 'de')).toBe('0 mm');
    expect(formatValue(151.9, RAIN, 'de')).toBe('152 mm');
    expect(formatValue(12.34, RAIN, 'de')).toBe('12,3 mm');
    expect(formatValue(151.9, RAIN, 'en')).toBe('152 mm');
  });

  it('nimmt das Histogramm der Woche, bei einer festen Ebene das eine', () => {
    expect(histogramFor(RAIN, '2025W39')?.anteile).toEqual([0.5, 0.5]);
    expect(histogramFor(RAIN, '2026W10')?.anteile).toEqual([0.8, 0.2]);
    expect(histogramFor(FOREST, '2025W39')?.anteile).toEqual([0.7, 0.3]);
    expect(histogramFor({ ...RAIN, histogramme: new Map() }, '2025W39')).toBeNull();
  });

  it('lässt ein Histogramm weg, dessen Kanten nicht zu den Anteilen passen', () => {
    expect(readHistogram({ klassen: [0, 1], anteile: [] })).toBeNull();
    expect(readHistogram({ klassen: [0, 1, 2], anteile: [0.5] })).toBeNull();
    expect(readHistogram(null)).toBeNull();
    expect(readHistogram({ klassen: [0, 1], anteile: [1] })).toEqual({ klassen: [0, 1], anteile: [1] });
  });

  it('rechnet den Anteil der Fläche, der eine Bedingung erfüllt', () => {
    const distribution = { klassen: [0, 10, 20, 30], anteile: [0.5, 0.3, 0.2] };

    expect(shareMet(distribution, 0, 30)).toBeCloseTo(1);
    expect(shareMet(distribution, 10, 20)).toBeCloseTo(0.3);
    expect(shareMet(distribution, 20, 30)).toBeCloseTo(0.2);
    // Eine halb getroffene Klasse zählt halb: gleichmäßig ist die ehrlichste Annahme.
    expect(shareMet(distribution, 15, 20)).toBeCloseTo(0.15);
    expect(shareMet(distribution, 5, 25)).toBeCloseTo(0.25 + 0.3 + 0.1);
    expect(shareMet(distribution, 40, 50)).toBe(0);
    expect(shareMet(distribution, -10, 100)).toBeCloseTo(1);
  });

  it('nennt die Einheit, auch wo ein Anteil als Prozent gilt', () => {
    expect(unitOf(RAIN)).toBe('mm');
    expect(unitOf(FOREST)).toBe('%');
    expect(formatNumber(0.72, FOREST, 'de')).toBe('72');
  });
});
