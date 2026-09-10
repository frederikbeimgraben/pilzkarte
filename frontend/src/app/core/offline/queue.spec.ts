import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
// `auto` legt IDBDatabase, IDBTransaction und die übrigen Klassen als Globale
// an. `idb` prüft gegen sie; ohne sie bräche schon das Öffnen.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { FIND, MARKER, ZONE } from '../../testing/entries-fixture';
import { Queue } from './queue';

function service(): Queue {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(Queue);
}

const FIND_INPUT = {
  artSlug: 'steinpilz',
  lat: 48.52,
  lon: 9.05,
  datum: '2026-09-06',
  anzahl: 3,
  notiz: null,
  sichtbarkeit: 'privat',
} as const;

const MARKER_INPUT = {
  name: 'Alter Fichtenhang',
  lat: 48.53,
  lon: 9.06,
  farbe: 'blau',
  notiz: null,
  sichtbarkeit: 'privat',
} as const;

const ZONE_INPUT = {
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
    const queue = service();

    const entry = await queue.put('fund', { ...FIND_INPUT }, [new Blob(['bild'])]);

    expect(entry?.art).toBe('fund');
    expect(queue.eintraege()).toHaveLength(1);
    expect((await queue.read())[0].fotos).toHaveLength(1);
  });

  it('sortiert nach dem Zeitpunkt des Anlegens', async () => {
    const queue = service();
    const times = ['2026-09-06T11:00:00.000Z', '2026-09-06T10:00:00.000Z'];
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => times.shift() ?? '');
    await queue.put('marker', { ...MARKER_INPUT, name: 'Spaeter' });
    await queue.put('marker', { ...MARKER_INPUT, name: 'Frueher' });

    const names = (await queue.read()).map((entry) => (entry.body as { name: string }).name);

    expect(names).toEqual(['Frueher', 'Spaeter']);
  });

  it('entfernt einen Eintrag', async () => {
    const queue = service();
    const entry = await queue.put('zone', { ...ZONE_INPUT });

    await queue.remove(entry?.id ?? '');

    expect(queue.eintraege()).toHaveLength(0);
  });

  it('sendet einen Fund samt Fotos und räumt ihn danach weg', async () => {
    const queue = service();
    await queue.put('fund', { ...FIND_INPUT }, [new Blob(['bild'], { type: 'image/jpeg' })]);
    const http = TestBed.inject(HttpTestingController);

    const sent = queue.send();
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush(FIND);
    });
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FIND.id}/fotos`).flush(FIND.fotos[0]);
    });

    expect(await sent).toBe(1);
    expect(queue.eintraege()).toHaveLength(0);
  });

  it('sendet einen Marker', async () => {
    const queue = service();
    await queue.put('marker', { ...MARKER_INPUT });
    const http = TestBed.inject(HttpTestingController);

    const sent = queue.send();
    await vi.waitFor(() => {
      http.expectOne('/api/marker').flush(MARKER);
    });

    expect(await sent).toBe(1);
  });

  it('sendet eine Zone', async () => {
    const queue = service();
    await queue.put('zone', { ...ZONE_INPUT });
    const http = TestBed.inject(HttpTestingController);

    const sent = queue.send();
    await vi.waitFor(() => {
      http.expectOne('/api/zonen').flush(ZONE);
    });

    expect(await sent).toBe(1);
  });

  it('bricht beim ersten Fehlschlag ab und behält den Eintrag', async () => {
    const queue = service();
    await queue.put('marker', { ...MARKER_INPUT, name: 'Eins' });
    await queue.put('marker', { ...MARKER_INPUT, name: 'Zwei' });
    const http = TestBed.inject(HttpTestingController);

    const sent = queue.send();
    await vi.waitFor(() => {
      http.expectOne('/api/marker').flush({ title: 'Kaputt', status: 500 }, { status: 500, statusText: '' });
    });

    expect(await sent).toBe(0);
    expect(queue.eintraege()).toHaveLength(2);
  });

  it('behält ein Foto, das nicht durchgeht, samt seinem Fund nicht doppelt', async () => {
    const queue = service();
    await queue.put('fund', { ...FIND_INPUT }, [new Blob(['bild'])]);
    const http = TestBed.inject(HttpTestingController);

    const sent = queue.send();
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush(FIND);
    });
    await vi.waitFor(() => {
      http
        .expectOne(`/api/funde/${FIND.id}/fotos`)
        .flush({ title: 'Zu groß', status: 413 }, { status: 413, statusText: '' });
    });

    expect(await sent).toBe(0);
    expect(queue.eintraege()).toHaveLength(1);
  });

  it('sendet nichts, wenn nichts wartet', async () => {
    expect(await service().send()).toBe(0);
  });

  describe('ohne IndexedDB', () => {
    let real: IDBFactory;

    beforeEach(() => {
      real = indexedDB;
      // Ein privates Fenster kann IndexedDB abschalten. Dann wirft schon der
      // Aufruf, und die Warteschlange muss das aushalten.
      vi.stubGlobal('indexedDB', undefined);
    });

    afterEach(() => {
      vi.stubGlobal('indexedDB', real);
    });

    it('nimmt keinen Eintrag an und bleibt leer', async () => {
      const queue = service();

      expect(await queue.put('marker', { ...MARKER_INPUT })).toBeNull();
      expect(await queue.read()).toEqual([]);
      await queue.remove('egal');
      expect(queue.eintraege()).toHaveLength(0);
    });
  });

  it('meldet auch einen abgelehnten Öffnen-Versuch als „kein Speicher“', async () => {
    // Der Browser darf das Öffnen ablehnen, statt zu werfen. Beide Wege enden
    // in derselben Antwort: es gibt keinen Platz für die Warteschlange.
    vi.stubGlobal('indexedDB', {
      open: () => ({
        error: new Error('gesperrt'),
        addEventListener: (kind: string, handler: () => void) => {
          if (kind === 'error') setTimeout(handler);
        },
        removeEventListener: () => undefined,
      }),
    });
    const queue = service();

    expect(await queue.put('marker', { ...MARKER_INPUT })).toBeNull();
  });
});
