import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
// `auto` legt IDBDatabase, IDBTransaction und die übrigen Klassen als Globale
// an. `idb` prüft gegen sie; ohne sie bräche schon das Öffnen.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { FUND, MARKER, ZONE } from '../../testing/eintraege-fixture';
import { Warteschlange } from './warteschlange';

function dienst(): Warteschlange {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(Warteschlange);
}

const FUND_EINGABE = {
  artSlug: 'steinpilz',
  lat: 48.52,
  lon: 9.05,
  datum: '2026-09-06',
  anzahl: 3,
  notiz: null,
  sichtbarkeit: 'privat',
} as const;

const MARKER_EINGABE = {
  name: 'Alter Fichtenhang',
  lat: 48.53,
  lon: 9.06,
  farbe: 'blau',
  notiz: null,
  sichtbarkeit: 'privat',
} as const;

const ZONE_EINGABE = {
  name: 'Schönbuch Nord',
  polygon: ZONE.polygon,
  farbe: 'gruen',
  notiz: null,
  sichtbarkeit: 'privat',
} as const;

describe('Warteschlange', () => {
  beforeEach(() => {
    // Eine frische Datenbank je Test. Ein Löschen ginge nicht: die Verbindung
    // des vorigen Tests steht noch und blockierte es.
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  it('legt einen Eintrag ab und findet ihn wieder', async () => {
    const warteschlange = dienst();

    const eintrag = await warteschlange.lege('fund', { ...FUND_EINGABE }, [new Blob(['bild'])]);

    expect(eintrag?.art).toBe('fund');
    expect(warteschlange.eintraege()).toHaveLength(1);
    expect((await warteschlange.lies())[0].fotos).toHaveLength(1);
  });

  it('sortiert nach dem Zeitpunkt des Anlegens', async () => {
    const warteschlange = dienst();
    const zeiten = ['2026-09-06T11:00:00.000Z', '2026-09-06T10:00:00.000Z'];
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => zeiten.shift() ?? '');
    await warteschlange.lege('marker', { ...MARKER_EINGABE, name: 'Spaeter' });
    await warteschlange.lege('marker', { ...MARKER_EINGABE, name: 'Frueher' });

    const namen = (await warteschlange.lies()).map((eintrag) => (eintrag.koerper as { name: string }).name);

    expect(namen).toEqual(['Frueher', 'Spaeter']);
  });

  it('entfernt einen Eintrag', async () => {
    const warteschlange = dienst();
    const eintrag = await warteschlange.lege('zone', { ...ZONE_EINGABE });

    await warteschlange.entferne(eintrag?.id ?? '');

    expect(warteschlange.eintraege()).toHaveLength(0);
  });

  it('sendet einen Fund samt Fotos und räumt ihn danach weg', async () => {
    const warteschlange = dienst();
    await warteschlange.lege('fund', { ...FUND_EINGABE }, [new Blob(['bild'], { type: 'image/jpeg' })]);
    const http = TestBed.inject(HttpTestingController);

    const gesendet = warteschlange.sende();
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush(FUND);
    });
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FUND.id}/fotos`).flush(FUND.fotos[0]);
    });

    expect(await gesendet).toBe(1);
    expect(warteschlange.eintraege()).toHaveLength(0);
  });

  it('sendet einen Marker', async () => {
    const warteschlange = dienst();
    await warteschlange.lege('marker', { ...MARKER_EINGABE });
    const http = TestBed.inject(HttpTestingController);

    const gesendet = warteschlange.sende();
    await vi.waitFor(() => {
      http.expectOne('/api/marker').flush(MARKER);
    });

    expect(await gesendet).toBe(1);
  });

  it('sendet eine Zone', async () => {
    const warteschlange = dienst();
    await warteschlange.lege('zone', { ...ZONE_EINGABE });
    const http = TestBed.inject(HttpTestingController);

    const gesendet = warteschlange.sende();
    await vi.waitFor(() => {
      http.expectOne('/api/zonen').flush(ZONE);
    });

    expect(await gesendet).toBe(1);
  });

  it('bricht beim ersten Fehlschlag ab und behält den Eintrag', async () => {
    const warteschlange = dienst();
    await warteschlange.lege('marker', { ...MARKER_EINGABE, name: 'Eins' });
    await warteschlange.lege('marker', { ...MARKER_EINGABE, name: 'Zwei' });
    const http = TestBed.inject(HttpTestingController);

    const gesendet = warteschlange.sende();
    await vi.waitFor(() => {
      http.expectOne('/api/marker').flush({ title: 'Kaputt', status: 500 }, { status: 500, statusText: '' });
    });

    expect(await gesendet).toBe(0);
    expect(warteschlange.eintraege()).toHaveLength(2);
  });

  it('behält ein Foto, das nicht durchgeht, samt seinem Fund nicht doppelt', async () => {
    const warteschlange = dienst();
    await warteschlange.lege('fund', { ...FUND_EINGABE }, [new Blob(['bild'])]);
    const http = TestBed.inject(HttpTestingController);

    const gesendet = warteschlange.sende();
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush(FUND);
    });
    await vi.waitFor(() => {
      http
        .expectOne(`/api/funde/${FUND.id}/fotos`)
        .flush({ title: 'Zu groß', status: 413 }, { status: 413, statusText: '' });
    });

    expect(await gesendet).toBe(0);
    expect(warteschlange.eintraege()).toHaveLength(1);
  });

  it('sendet nichts, wenn nichts wartet', async () => {
    expect(await dienst().sende()).toBe(0);
  });

  describe('ohne IndexedDB', () => {
    let echt: IDBFactory;

    beforeEach(() => {
      echt = indexedDB;
      // Ein privates Fenster kann IndexedDB abschalten. Dann wirft schon der
      // Aufruf, und die Warteschlange muss das aushalten.
      vi.stubGlobal('indexedDB', undefined);
    });

    afterEach(() => {
      vi.stubGlobal('indexedDB', echt);
    });

    it('nimmt keinen Eintrag an und bleibt leer', async () => {
      const warteschlange = dienst();

      expect(await warteschlange.lege('marker', { ...MARKER_EINGABE })).toBeNull();
      expect(await warteschlange.lies()).toEqual([]);
      await warteschlange.entferne('egal');
      expect(warteschlange.eintraege()).toHaveLength(0);
    });
  });

  it('meldet auch einen abgelehnten Öffnen-Versuch als „kein Speicher“', async () => {
    // Der Browser darf das Öffnen ablehnen, statt zu werfen. Beide Wege enden
    // in derselben Antwort: es gibt keinen Platz für die Warteschlange.
    vi.stubGlobal('indexedDB', {
      open: () => ({
        error: new Error('gesperrt'),
        addEventListener: (typ: string, hoerer: () => void) => {
          if (typ === 'error') setTimeout(hoerer);
        },
        removeEventListener: () => undefined,
      }),
    });
    const warteschlange = dienst();

    expect(await warteschlange.lege('marker', { ...MARKER_EINGABE })).toBeNull();
  });
});
