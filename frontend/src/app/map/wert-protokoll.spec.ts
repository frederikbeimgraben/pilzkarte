import { ArbeiterAttrappe } from '../testing/karte-attrappen';
import { leseManifest } from '../core/kacheln/manifest';
import { WertProtokoll, artQuelle, wertVorlage, zerlegeWertUrl } from './wert-protokoll';
import { VORHERSAGE_RAMPE } from '../ui/ramp/rampe-farben';
import type { FaerbeAuftrag, VorladeAuftrag } from './wert-nachrichten';

const MANIFEST = leseManifest(
  {
    top: 0.5,
    tiles: { zooms: [5, 8], have: { '7': ['66/42', '67/42'] } },
    weeks: [],
  },
  'boletus_edulis',
);

function protokoll(): { wert: WertProtokoll; arbeiter: ArbeiterAttrappe } {
  const arbeiter = new ArbeiterAttrappe();
  const wert = new WertProtokoll(() => arbeiter);
  wert.melde(artQuelle(MANIFEST.slug, MANIFEST.top, MANIFEST.vorhanden));
  return { wert, arbeiter };
}

describe('wert://', () => {
  it('baut die Vorlage einer Rasterquelle', () => {
    expect(wertVorlage('boletus_edulis', 'boletus_edulis_kacheln/2025W40')).toBe(
      'wert://boletus_edulis/boletus_edulis_kacheln/2025W40/{z}/{x}/{y}',
    );
  });

  it('zerlegt eine Adresse mit Schrägstrichen im Wochenordner', () => {
    expect(zerlegeWertUrl('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/66/42')).toEqual({
      quelle: 'boletus_edulis',
      ordner: 'boletus_edulis_kacheln/2025W40',
      z: 7,
      x: 66,
      y: 42,
    });
    expect(zerlegeWertUrl('http://example.org/7/66/42')).toBeNull();
  });

  it('färbt eine vorhandene Kachel über den Worker', async () => {
    const { wert, arbeiter } = protokoll();
    const bild = { breite: 256 } as unknown as ImageBitmap;

    const lauf = wert.aufloesen('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/66/42');
    const auftrag = arbeiter.auftraege[0] as FaerbeAuftrag;
    arbeiter.antworte({ id: auftrag.id, bild });

    expect(auftrag).toEqual({
      typ: 'faerbe',
      id: 0,
      url: '/boletus_edulis_kacheln/2025W40/7/66/42.png',
      skala: { art: 'wahrscheinlichkeit', top: 0.5 },
      farben: VORHERSAGE_RAMPE,
    });
    await expect(lauf).resolves.toEqual({ data: bild });
  });

  it('liefert eine leere Kachel, ohne zu fragen, wo es keine Daten gibt', async () => {
    const { wert, arbeiter } = protokoll();

    const leer = await wert.aufloesen('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/99/99');
    const falscheArt = await wert.aufloesen('wert://pfifferling/pfifferling_kacheln/2025W40/7/66/42');
    const unsinn = await wert.aufloesen('wert://kaputt');

    expect((leer.data as ArrayBuffer).byteLength).toBe(0);
    expect((falscheArt.data as ArrayBuffer).byteLength).toBe(0);
    expect((unsinn.data as ArrayBuffer).byteLength).toBe(0);
    expect(arbeiter.auftraege).toHaveLength(0);
  });

  it('liefert leer, wenn der Worker nichts findet', async () => {
    const { wert, arbeiter } = protokoll();

    const lauf = wert.aufloesen('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/7/66/42');
    arbeiter.antworte({ id: 0, bild: null });
    const antwort = await lauf;

    expect((antwort.data as ArrayBuffer).byteLength).toBe(0);
  });

  it('lädt nur Nachbarkacheln vor, die es gibt', () => {
    const { wert, arbeiter } = protokoll();

    wert.vorladen(
      'boletus_edulis',
      ['boletus_edulis_kacheln/2025W39', 'boletus_edulis_kacheln/2025W41'],
      [
        [7, 66, 42],
        [7, 99, 99],
      ],
    );

    expect((arbeiter.auftraege[0] as VorladeAuftrag).urls).toEqual([
      '/boletus_edulis_kacheln/2025W39/7/66/42.png',
      '/boletus_edulis_kacheln/2025W41/7/66/42.png',
    ]);
  });

  it('lädt nichts vor für eine unbekannte Art oder ohne Treffer', () => {
    const { wert, arbeiter } = protokoll();

    wert.vorladen('pfifferling', ['pfifferling_kacheln/2025W39'], [[7, 66, 42]]);
    wert.vorladen('boletus_edulis', ['boletus_edulis_kacheln/2025W39'], [[7, 99, 99]]);

    expect(arbeiter.auftraege).toHaveLength(0);
  });

  it('beendet den Worker beim Aufräumen', () => {
    const { wert, arbeiter } = protokoll();

    wert.beende();

    expect(arbeiter.beendet).toBe(true);
  });
});
