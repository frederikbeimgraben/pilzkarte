import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { QueueEntry } from '../../core/offline/queue';
import { Queue } from '../../core/offline/queue';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { FIND, SHARED_FIND, MARKER, ZONE, page } from '../../testing/entries-fixture';
import { EntriesState } from './entries.state';

/** Eine Warteschlange ohne IndexedDB: sie merkt sich, was sie bekommen hat. */
class QueueStub {
  readonly stored: { art: string; body: unknown; fotos: readonly Blob[] }[] = [];
  /** Wenn falsch, gibt es keinen Platz auf dem Gerät. */
  accepts = true;
  sent = 0;
  private readonly catalogue = signalList();

  readonly eintraege = this.catalogue.read;

  put(art: string, body: unknown, fotos: readonly Blob[] = []): Promise<unknown> {
    if (!this.accepts) return Promise.resolve(null);
    this.stored.push({ art, body, fotos });
    this.catalogue.set([{ id: `w-${this.stored.length}`, art } as unknown as QueueEntry]);
    return Promise.resolve({ id: 'w-1' });
  }

  read(): Promise<readonly QueueEntry[]> {
    return Promise.resolve(this.catalogue.read());
  }

  send(): Promise<number> {
    return Promise.resolve(this.sent);
  }
}

function signalList(): {
  read: () => readonly QueueEntry[];
  set: (values: readonly QueueEntry[]) => void;
} {
  let values: readonly QueueEntry[] = [];
  return { read: () => values, set: (next) => (values = next) };
}

interface Setup {
  state: EntriesState;
  http: HttpTestingController;
  auth: AuthStub;
  queue: QueueStub;
}

function build(): Setup {
  const auth = new AuthStub();
  const queue = new QueueStub();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ...authStubProviders(auth),
      { provide: Queue, useValue: queue as unknown as Queue },
    ],
  });
  return {
    state: TestBed.inject(EntriesState),
    http: TestBed.inject(HttpTestingController),
    auth,
    queue,
  };
}

describe('EintraegeZustand', () => {
  it('holt Funde, Marker und Zonen des Kontos', async () => {
    const { state, http } = build();

    const loaded = state.load();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(page([FIND]));
    });
    http.expectOne('/api/marker?limit=200').flush(page([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(page([ZONE]));
    await loaded;

    expect(state.finds()).toEqual([FIND]);
    expect(state.marker()).toEqual([MARKER]);
    expect(state.zones()).toEqual([ZONE]);
    expect(state.melder()).toBe('Frederik');
  });

  it('holt ohne Konto nichts und leert, was noch dastand', async () => {
    const { state, auth, http } = build();
    auth.user.set(null);

    await state.load();

    http.expectNone('/api/funde?limit=200');
    expect(state.finds()).toEqual([]);
    expect(state.melder()).toBeNull();
  });

  it('lässt bei einem Ausfall stehen, was schon da war', async () => {
    const { state, http } = build();
    const first = state.load();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(page([FIND]));
    });
    http.expectOne('/api/marker?limit=200').flush(page([]));
    http.expectOne('/api/zonen?limit=200').flush(page([]));
    await first;

    const second = state.load();
    await vi.waitFor(() => {
      http
        .expectOne('/api/funde?limit=200')
        .flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });
    http.expectOne('/api/marker?limit=200').flush(page([]));
    http.expectOne('/api/zonen?limit=200').flush(page([]));
    await second;

    expect(state.finds()).toEqual([FIND]);
    expect(state.loading()).toBe(false);
  });

  it('holt geteilte Funde im Ausschnitt und hält sie bei einem Ausfall', async () => {
    const { state, http } = build();

    const loaded = state.loadShared({ west: 9, south: 48, ost: 10, nord: 49 });
    await vi.waitFor(() => {
      http.expectOne('/api/funde/geteilt?bbox=9,48,10,49&limit=200').flush(page([SHARED_FIND]));
    });
    await loaded;
    expect(state.shared()).toEqual([SHARED_FIND]);

    const second = state.loadShared();
    await vi.waitFor(() => {
      http
        .expectOne('/api/funde/geteilt?limit=200')
        .flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });
    await second;
    expect(state.shared()).toEqual([SHARED_FIND]);
  });

  it('speichert einen Fund mit seinen Fotos', async () => {
    const { state, http } = build();

    const result = state.saveFind(input(), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush(FIND);
    });
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FIND.id}/fotos`).flush(FIND.fotos[0]);
    });

    expect(await result).toBe('gespeichert');
    expect(state.finds()[0].fotos).toHaveLength(2);
  });

  it('lässt den Fund stehen, wenn ein Foto nicht durchgeht', async () => {
    const { state, http } = build();

    const result = state.saveFind(input(), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush({ ...FIND, fotos: [] });
    });
    await vi.waitFor(() => {
      http
        .expectOne(`/api/funde/${FIND.id}/fotos`)
        .flush({ title: 'Zu groß', status: 413 }, { status: 413, statusText: '' });
    });

    expect(await result).toBe('gespeichert');
    expect(state.finds()[0].fotos).toHaveLength(0);
  });

  it('stellt einen Fund an, wenn niemand sich anmelden will', async () => {
    const { state, auth, queue, http } = build();
    auth.reply = false;

    expect(await state.saveFind(input())).toBe('wartet');
    expect(queue.stored[0].art).toBe('fund');
    http.expectNone('/api/funde');
  });

  it('stellt einen Fund an, wenn das Netz fehlt', async () => {
    const { state, queue, http } = build();

    const result = state.saveFind(input());
    await vi.waitFor(() => {
      http.expectOne('/api/funde').error(new ProgressEvent('error'));
    });

    expect(await result).toBe('wartet');
    expect(queue.stored).toHaveLength(1);
  });

  it('meldet „verworfen“, wenn auch das Gerät keinen Platz hat', async () => {
    const { state, auth, queue } = build();
    auth.reply = false;
    queue.accepts = false;

    expect(await state.saveFind(input())).toBe('verworfen');
  });

  it('speichert und stellt Marker und Zonen genauso an', async () => {
    const { state, auth, http, queue } = build();

    const marker = state.saveMarker({ ...MARKER });
    await vi.waitFor(() => {
      http.expectOne('/api/marker').flush(MARKER);
    });
    expect(await marker).toBe('gespeichert');
    expect(state.marker()).toEqual([MARKER]);

    const zone = state.saveZone({ ...ZONE });
    await vi.waitFor(() => {
      http.expectOne('/api/zonen').flush(ZONE);
    });
    expect(await zone).toBe('gespeichert');
    expect(state.zones()).toEqual([ZONE]);

    auth.reply = false;
    expect(await state.saveMarker({ ...MARKER })).toBe('wartet');
    expect(await state.saveZone({ ...ZONE })).toBe('wartet');
    expect(queue.stored.map((entry) => entry.art)).toEqual(['marker', 'zone']);
  });

  it('stellt Marker und Zone an, wenn das Netz fehlt', async () => {
    const { state, http, queue } = build();

    const marker = state.saveMarker({ ...MARKER });
    await vi.waitFor(() => {
      http.expectOne('/api/marker').error(new ProgressEvent('error'));
    });
    expect(await marker).toBe('wartet');

    const zone = state.saveZone({ ...ZONE });
    await vi.waitFor(() => {
      http.expectOne('/api/zonen').error(new ProgressEvent('error'));
    });
    expect(await zone).toBe('wartet');
    expect(queue.stored).toHaveLength(2);
  });

  it('ändert und löscht jedes Objekt und meldet den Fehlschlag', async () => {
    const { state, http } = build();
    const loaded = state.load();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(page([FIND]));
    });
    http.expectOne('/api/marker?limit=200').flush(page([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(page([ZONE]));
    await loaded;

    const find = state.updateFind(FIND.id, { anzahl: 4 });
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FIND.id}`).flush({ ...FIND, anzahl: 4 });
    });
    expect(await find).toBe(true);
    expect(state.finds()[0].anzahl).toBe(4);

    const marker = state.updateMarker(MARKER.id, { name: 'Neu' });
    await vi.waitFor(() => {
      http.expectOne(`/api/marker/${MARKER.id}`).flush({ ...MARKER, name: 'Neu' });
    });
    expect(await marker).toBe(true);
    expect(state.marker()[0].name).toBe('Neu');

    const zone = state.updateZone(ZONE.id, { name: 'Neu' });
    await vi.waitFor(() => {
      http.expectOne(`/api/zonen/${ZONE.id}`).flush({ ...ZONE, name: 'Neu' });
    });
    expect(await zone).toBe(true);

    const away = state.deleteFind(FIND.id);
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FIND.id}`).flush(null);
    });
    expect(await away).toBe(true);
    expect(state.finds()).toEqual([]);

    const markerGone = state.deleteMarker(MARKER.id);
    await vi.waitFor(() => {
      http.expectOne(`/api/marker/${MARKER.id}`).flush(null);
    });
    expect(await markerGone).toBe(true);

    const zoneGone = state.deleteZone(ZONE.id);
    await vi.waitFor(() => {
      http.expectOne(`/api/zonen/${ZONE.id}`).flush(null);
    });
    expect(await zoneGone).toBe(true);
    expect(state.zones()).toEqual([]);
  });

  it('meldet einen Fehlschlag bei jeder Änderung und jedem Löschen', async () => {
    const { state, http } = build();
    const broken = (): void => {
      http
        .match(() => true)
        .forEach((request) => {
          request.error(new ProgressEvent('error'));
        });
    };

    const calls = [
      state.updateFind('x', {}),
      state.updateMarker('x', {}),
      state.updateZone('x', {}),
      state.deleteFind('x'),
      state.deleteMarker('x'),
      state.deleteZone('x'),
    ];
    await vi.waitFor(broken);

    expect(await Promise.all(calls)).toEqual([false, false, false, false, false, false]);
  });

  it('sendet Wartendes nur mit Konto und lädt danach neu', async () => {
    const { state, auth, queue, http } = build();
    auth.user.set(null);
    expect(await state.sendPending()).toBe(0);

    auth.user.set({ sub: 'sub-eins', name: 'Frederik', email: '' });
    queue.sent = 2;
    const sent = state.sendPending();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(page([]));
    });
    http.expectOne('/api/marker?limit=200').flush(page([]));
    http.expectOne('/api/zonen?limit=200').flush(page([]));

    expect(await sent).toBe(2);
  });
});

function input(): Parameters<EntriesState['saveFind']>[0] {
  return {
    artSlug: 'steinpilz',
    lat: 48.52,
    lon: 9.05,
    datum: '2026-09-06',
    anzahl: 3,
    notiz: null,
    sichtbarkeit: 'privat',
  };
}
