import { WorkerDouble } from '../testing/map-doubles';
import { readManifest } from '../core/tiles/manifest';
import { ValueProtocol, speciesSource, valueTemplate, parseValueUrl } from './value-protocol';
import { FORECAST_RAMP } from '../ui/ramp/ramp-colors';
import type { ColorizeJob, CombinationJob, PrefetchJob } from './value-messages';

const MANIFEST = readManifest(
  {
    top: 0.5,
    tiles: { zooms: [5, 8], have: { '7': ['66/42', '67/42'] } },
    weeks: [],
  },
  'boletus_edulis',
);

function protocol(): { value: ValueProtocol; worker: WorkerDouble } {
  const worker = new WorkerDouble();
  const value = new ValueProtocol(() => worker);
  value.report(speciesSource(MANIFEST.slug, MANIFEST.top, MANIFEST.existing));
  return { value, worker };
}

describe('wert://', () => {
  it('baut die Vorlage einer Rasterquelle', () => {
    expect(valueTemplate('boletus_edulis', 'boletus_edulis_kacheln/2025W40')).toBe(
      'wert://boletus_edulis/boletus_edulis_kacheln/2025W40/{z}/{x}/{y}',
    );
  });

  it('zerlegt eine Adresse mit Schrägstrichen im Wochenordner', () => {
    expect(parseValueUrl('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/66/42')).toEqual({
      source: 'boletus_edulis',
      folder: 'boletus_edulis_kacheln/2025W40',
      z: 7,
      x: 66,
      y: 42,
    });
    expect(parseValueUrl('http://example.org/7/66/42')).toBeNull();
  });

  it('färbt eine vorhandene Kachel über den Worker', async () => {
    const { value, worker } = protocol();
    const shot = { breite: 256 } as unknown as ImageBitmap;

    const run = value.resolve('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/66/42');
    const job = worker.jobs[0] as ColorizeJob;
    worker.answer({ id: job.id, shot });

    expect(job).toEqual({
      kind: 'faerbe',
      id: 0,
      url: '/boletus_edulis_kacheln/2025W40/7/66/42.png',
      scale: { art: 'wahrscheinlichkeit', top: 0.5 },
      colors: FORECAST_RAMP,
    });
    await expect(run).resolves.toEqual({ data: shot });
  });

  it('liefert eine leere Kachel, ohne zu fragen, wo es keine Daten gibt', async () => {
    const { value, worker } = protocol();

    const empty = await value.resolve('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/99/99');
    const wrongSpecies = await value.resolve('wert://pfifferling/pfifferling_kacheln/2025W40/7/66/42');
    const nonsense = await value.resolve('wert://kaputt');

    expect((empty.data as ArrayBuffer).byteLength).toBe(0);
    expect((wrongSpecies.data as ArrayBuffer).byteLength).toBe(0);
    expect((nonsense.data as ArrayBuffer).byteLength).toBe(0);
    expect(worker.jobs).toHaveLength(0);
  });

  it('liefert leer, wenn der Worker nichts findet', async () => {
    const { value, worker } = protocol();

    const run = value.resolve('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/66/42');
    worker.answer({ id: 0, shot: null });
    const reply = await run;

    expect((reply.data as ArrayBuffer).byteLength).toBe(0);
  });

  it('lädt nur Nachbarkacheln vor, die es gibt', () => {
    const { value, worker } = protocol();

    value.prefetch(
      'boletus_edulis',
      ['boletus_edulis_kacheln/2025W39', 'boletus_edulis_kacheln/2025W41'],
      [
        [7, 66, 42],
        [7, 99, 99],
      ],
    );

    expect((worker.jobs[0] as PrefetchJob).urls).toEqual([
      '/boletus_edulis_kacheln/2025W39/7/66/42.png',
      '/boletus_edulis_kacheln/2025W41/7/66/42.png',
    ]);
  });

  it('lädt nichts vor für eine unbekannte Art oder ohne Treffer', () => {
    const { value, worker } = protocol();

    value.prefetch('pfifferling', ['pfifferling_kacheln/2025W39'], [[7, 66, 42]]);
    value.prefetch('boletus_edulis', ['boletus_edulis_kacheln/2025W39'], [[7, 99, 99]]);

    expect(worker.jobs).toHaveLength(0);
  });

  it('beendet den Worker beim Aufräumen', () => {
    const { value, worker } = protocol();

    value.stop();

    expect(worker.stopped).toBe(true);
  });

  it('fragt eine zusammengesetzte Quelle mit allen Teilen an', async () => {
    const { value, worker } = protocol();
    const bound = { von: 100, bis: 255, edge: 25 };
    value.reportCombination({
      id: 'kombi',
      rule: 'schnitt',
      colors: ['#004225'],
      parts: [
        { folder: 'layers_kacheln/regen_4w/2025W40', bound, existing: MANIFEST.existing },
        { folder: 'layers_kacheln/wald', bound, existing: MANIFEST.existing },
      ],
    });
    const shot = { breite: 256 } as unknown as ImageBitmap;

    const run = value.resolve('wert://kombi/a1b2c3d4/7/66/42');
    const job = worker.jobs[0] as CombinationJob;
    worker.answer({ id: job.id, shot });

    expect(job.kind).toBe('kombi');
    expect(job.rule).toBe('schnitt');
    expect(job.parts.map((part) => part.url)).toEqual([
      '/layers_kacheln/regen_4w/2025W40/7/66/42.png',
      '/layers_kacheln/wald/7/66/42.png',
    ]);
    await expect(run).resolves.toEqual({ data: shot });
  });

  it('lässt die Kombination leer, wo einem Teil die Kachel fehlt', async () => {
    const { value, worker } = protocol();
    const bound = { von: 1, bis: 255, edge: 25 };
    value.reportCombination({
      id: 'kombi',
      rule: 'abgestuft',
      colors: ['#0d0827'],
      parts: [
        { folder: 'a', bound, existing: MANIFEST.existing },
        { folder: 'b', bound, existing: new Set<string>() },
      ],
    });

    const reply = await value.resolve('wert://kombi/a1b2c3d4/7/66/42');

    expect((reply.data as ArrayBuffer).byteLength).toBe(0);
    expect(worker.jobs).toHaveLength(0);
  });

  it('lässt eine Kombination ohne Teile leer', async () => {
    const { value } = protocol();
    value.reportCombination({ id: 'kombi', rule: 'schnitt', colors: ['#004225'], parts: [] });

    const reply = await value.resolve('wert://kombi/a1b2c3d4/7/66/42');

    expect((reply.data as ArrayBuffer).byteLength).toBe(0);
  });
});
