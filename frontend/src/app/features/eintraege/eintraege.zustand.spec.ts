import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { WarteEintrag } from '../../core/offline/warteschlange';
import { Warteschlange } from '../../core/offline/warteschlange';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { FUND, GETEILTER_FUND, MARKER, ZONE, seite } from '../../testing/eintraege-fixture';
import { EintraegeZustand } from './eintraege.zustand';

/** Eine Warteschlange ohne IndexedDB: sie merkt sich, was sie bekommen hat. */
class WarteStummel {
  readonly abgelegt: { art: string; koerper: unknown; fotos: readonly Blob[] }[] = [];
  /** Wenn falsch, gibt es keinen Platz auf dem Gerät. */
  nimmtAn = true;
  gesendet = 0;
  private readonly liste = signalListe();

  readonly eintraege = this.liste.lesen;

  lege(art: string, koerper: unknown, fotos: readonly Blob[] = []): Promise<unknown> {
    if (!this.nimmtAn) return Promise.resolve(null);
    this.abgelegt.push({ art, koerper, fotos });
    this.liste.setzen([{ id: `w-${this.abgelegt.length}`, art } as unknown as WarteEintrag]);
    return Promise.resolve({ id: 'w-1' });
  }

  lies(): Promise<readonly WarteEintrag[]> {
    return Promise.resolve(this.liste.lesen());
  }

  sende(): Promise<number> {
    return Promise.resolve(this.gesendet);
  }
}

function signalListe(): {
  lesen: () => readonly WarteEintrag[];
  setzen: (werte: readonly WarteEintrag[]) => void;
} {
  let werte: readonly WarteEintrag[] = [];
  return { lesen: () => werte, setzen: (neu) => (werte = neu) };
}

interface Aufbau {
  zustand: EintraegeZustand;
  http: HttpTestingController;
  auth: AuthStummel;
  warteschlange: WarteStummel;
}

function aufbauen(): Aufbau {
  const auth = new AuthStummel();
  const warteschlange = new WarteStummel();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ...authStummelAnbieter(auth),
      { provide: Warteschlange, useValue: warteschlange as unknown as Warteschlange },
    ],
  });
  return {
    zustand: TestBed.inject(EintraegeZustand),
    http: TestBed.inject(HttpTestingController),
    auth,
    warteschlange,
  };
}

describe('EintraegeZustand', () => {
  it('holt Funde, Marker und Zonen des Kontos', async () => {
    const { zustand, http } = aufbauen();

    const geladen = zustand.lade();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(seite([FUND]));
    });
    http.expectOne('/api/marker?limit=200').flush(seite([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(seite([ZONE]));
    await geladen;

    expect(zustand.funde()).toEqual([FUND]);
    expect(zustand.marker()).toEqual([MARKER]);
    expect(zustand.zonen()).toEqual([ZONE]);
    expect(zustand.melder()).toBe('Frederik');
  });

  it('holt ohne Konto nichts und leert, was noch dastand', async () => {
    const { zustand, auth, http } = aufbauen();
    auth.nutzer.set(null);

    await zustand.lade();

    http.expectNone('/api/funde?limit=200');
    expect(zustand.funde()).toEqual([]);
    expect(zustand.melder()).toBeNull();
  });

  it('lässt bei einem Ausfall stehen, was schon da war', async () => {
    const { zustand, http } = aufbauen();
    const erst = zustand.lade();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(seite([FUND]));
    });
    http.expectOne('/api/marker?limit=200').flush(seite([]));
    http.expectOne('/api/zonen?limit=200').flush(seite([]));
    await erst;

    const zweit = zustand.lade();
    await vi.waitFor(() => {
      http
        .expectOne('/api/funde?limit=200')
        .flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });
    http.expectOne('/api/marker?limit=200').flush(seite([]));
    http.expectOne('/api/zonen?limit=200').flush(seite([]));
    await zweit;

    expect(zustand.funde()).toEqual([FUND]);
    expect(zustand.laedt()).toBe(false);
  });

  it('holt geteilte Funde im Ausschnitt und hält sie bei einem Ausfall', async () => {
    const { zustand, http } = aufbauen();

    const geladen = zustand.ladeGeteilte({ west: 9, sued: 48, ost: 10, nord: 49 });
    await vi.waitFor(() => {
      http.expectOne('/api/funde/geteilt?bbox=9,48,10,49&limit=200').flush(seite([GETEILTER_FUND]));
    });
    await geladen;
    expect(zustand.geteilte()).toEqual([GETEILTER_FUND]);

    const zweit = zustand.ladeGeteilte();
    await vi.waitFor(() => {
      http
        .expectOne('/api/funde/geteilt?limit=200')
        .flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });
    await zweit;
    expect(zustand.geteilte()).toEqual([GETEILTER_FUND]);
  });

  it('speichert einen Fund mit seinen Fotos', async () => {
    const { zustand, http } = aufbauen();

    const ablage = zustand.speichereFund(eingabe(), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush(FUND);
    });
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FUND.id}/fotos`).flush(FUND.fotos[0]);
    });

    expect(await ablage).toBe('gespeichert');
    expect(zustand.funde()[0].fotos).toHaveLength(2);
  });

  it('lässt den Fund stehen, wenn ein Foto nicht durchgeht', async () => {
    const { zustand, http } = aufbauen();

    const ablage = zustand.speichereFund(eingabe(), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne('/api/funde').flush({ ...FUND, fotos: [] });
    });
    await vi.waitFor(() => {
      http
        .expectOne(`/api/funde/${FUND.id}/fotos`)
        .flush({ title: 'Zu groß', status: 413 }, { status: 413, statusText: '' });
    });

    expect(await ablage).toBe('gespeichert');
    expect(zustand.funde()[0].fotos).toHaveLength(0);
  });

  it('stellt einen Fund an, wenn niemand sich anmelden will', async () => {
    const { zustand, auth, warteschlange, http } = aufbauen();
    auth.antwort = false;

    expect(await zustand.speichereFund(eingabe())).toBe('wartet');
    expect(warteschlange.abgelegt[0].art).toBe('fund');
    http.expectNone('/api/funde');
  });

  it('stellt einen Fund an, wenn das Netz fehlt', async () => {
    const { zustand, warteschlange, http } = aufbauen();

    const ablage = zustand.speichereFund(eingabe());
    await vi.waitFor(() => {
      http.expectOne('/api/funde').error(new ProgressEvent('error'));
    });

    expect(await ablage).toBe('wartet');
    expect(warteschlange.abgelegt).toHaveLength(1);
  });

  it('meldet „verworfen“, wenn auch das Gerät keinen Platz hat', async () => {
    const { zustand, auth, warteschlange } = aufbauen();
    auth.antwort = false;
    warteschlange.nimmtAn = false;

    expect(await zustand.speichereFund(eingabe())).toBe('verworfen');
  });

  it('speichert und stellt Marker und Zonen genauso an', async () => {
    const { zustand, auth, http, warteschlange } = aufbauen();

    const marker = zustand.speichereMarker({ ...MARKER });
    await vi.waitFor(() => {
      http.expectOne('/api/marker').flush(MARKER);
    });
    expect(await marker).toBe('gespeichert');
    expect(zustand.marker()).toEqual([MARKER]);

    const zone = zustand.speichereZone({ ...ZONE });
    await vi.waitFor(() => {
      http.expectOne('/api/zonen').flush(ZONE);
    });
    expect(await zone).toBe('gespeichert');
    expect(zustand.zonen()).toEqual([ZONE]);

    auth.antwort = false;
    expect(await zustand.speichereMarker({ ...MARKER })).toBe('wartet');
    expect(await zustand.speichereZone({ ...ZONE })).toBe('wartet');
    expect(warteschlange.abgelegt.map((eintrag) => eintrag.art)).toEqual(['marker', 'zone']);
  });

  it('stellt Marker und Zone an, wenn das Netz fehlt', async () => {
    const { zustand, http, warteschlange } = aufbauen();

    const marker = zustand.speichereMarker({ ...MARKER });
    await vi.waitFor(() => {
      http.expectOne('/api/marker').error(new ProgressEvent('error'));
    });
    expect(await marker).toBe('wartet');

    const zone = zustand.speichereZone({ ...ZONE });
    await vi.waitFor(() => {
      http.expectOne('/api/zonen').error(new ProgressEvent('error'));
    });
    expect(await zone).toBe('wartet');
    expect(warteschlange.abgelegt).toHaveLength(2);
  });

  it('ändert und löscht jedes Objekt und meldet den Fehlschlag', async () => {
    const { zustand, http } = aufbauen();
    const geladen = zustand.lade();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(seite([FUND]));
    });
    http.expectOne('/api/marker?limit=200').flush(seite([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(seite([ZONE]));
    await geladen;

    const fund = zustand.aendereFund(FUND.id, { anzahl: 4 });
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FUND.id}`).flush({ ...FUND, anzahl: 4 });
    });
    expect(await fund).toBe(true);
    expect(zustand.funde()[0].anzahl).toBe(4);

    const marker = zustand.aendereMarker(MARKER.id, { name: 'Neu' });
    await vi.waitFor(() => {
      http.expectOne(`/api/marker/${MARKER.id}`).flush({ ...MARKER, name: 'Neu' });
    });
    expect(await marker).toBe(true);
    expect(zustand.marker()[0].name).toBe('Neu');

    const zone = zustand.aendereZone(ZONE.id, { name: 'Neu' });
    await vi.waitFor(() => {
      http.expectOne(`/api/zonen/${ZONE.id}`).flush({ ...ZONE, name: 'Neu' });
    });
    expect(await zone).toBe(true);

    const weg = zustand.loescheFund(FUND.id);
    await vi.waitFor(() => {
      http.expectOne(`/api/funde/${FUND.id}`).flush(null);
    });
    expect(await weg).toBe(true);
    expect(zustand.funde()).toEqual([]);

    const markerWeg = zustand.loescheMarker(MARKER.id);
    await vi.waitFor(() => {
      http.expectOne(`/api/marker/${MARKER.id}`).flush(null);
    });
    expect(await markerWeg).toBe(true);

    const zoneWeg = zustand.loescheZone(ZONE.id);
    await vi.waitFor(() => {
      http.expectOne(`/api/zonen/${ZONE.id}`).flush(null);
    });
    expect(await zoneWeg).toBe(true);
    expect(zustand.zonen()).toEqual([]);
  });

  it('meldet einen Fehlschlag bei jeder Änderung und jedem Löschen', async () => {
    const { zustand, http } = aufbauen();
    const kaputt = (): void => {
      http
        .match(() => true)
        .forEach((anfrage) => {
          anfrage.error(new ProgressEvent('error'));
        });
    };

    const rufe = [
      zustand.aendereFund('x', {}),
      zustand.aendereMarker('x', {}),
      zustand.aendereZone('x', {}),
      zustand.loescheFund('x'),
      zustand.loescheMarker('x'),
      zustand.loescheZone('x'),
    ];
    await vi.waitFor(kaputt);

    expect(await Promise.all(rufe)).toEqual([false, false, false, false, false, false]);
  });

  it('sendet Wartendes nur mit Konto und lädt danach neu', async () => {
    const { zustand, auth, warteschlange, http } = aufbauen();
    auth.nutzer.set(null);
    expect(await zustand.sendeWartende()).toBe(0);

    auth.nutzer.set({ sub: 'sub-eins', name: 'Frederik', email: '' });
    warteschlange.gesendet = 2;
    const gesendet = zustand.sendeWartende();
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(seite([]));
    });
    http.expectOne('/api/marker?limit=200').flush(seite([]));
    http.expectOne('/api/zonen?limit=200').flush(seite([]));

    expect(await gesendet).toBe(2);
  });
});

function eingabe(): Parameters<EintraegeZustand['speichereFund']>[0] {
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
