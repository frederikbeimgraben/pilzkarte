import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Queue } from '../../core/offline/queue';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND, MARKER, ZONE } from '../../testing/entries-fixture';
import { MapAdapterDouble } from '../../testing/map-doubles';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { AddEntryComponent } from './add-entry.component';
import { AddEntryState } from './add-entry.state';

/** Eine Warteschlange ohne IndexedDB. */
class QueueStub {
  readonly stored: string[] = [];
  eintraege = (): [] => [];
  put(art: string): Promise<{ id: string }> {
    this.stored.push(art);
    return Promise.resolve({ id: 'w-1' });
  }
  read(): Promise<[]> {
    return Promise.resolve([]);
  }
  send(): Promise<number> {
    return Promise.resolve(0);
  }
}

interface Setup {
  container: Element;
  flow: AddEntryState;
  map: MapAdapterDouble;
  auth: AuthStub;
  queue: QueueStub;
  http: HttpTestingController;
  toasts: ToastSpy;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const map = new MapAdapterDouble();
  const auth = new AuthStub();
  const queue = new QueueStub();
  const { container, detectChanges } = await render(AddEntryComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAP_ADAPTER, useValue: map },
      { provide: Queue, useValue: queue },
      ...authStubProviders(auth),
    ],
  });
  return {
    container,
    flow: TestBed.inject(AddEntryState),
    map,
    auth,
    queue,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpy(),
    refresh: detectChanges,
  };
}

/** Das Aktionsblatt öffnen und dort eine Zeile wählen. */
async function start(setup: Setup, row: RegExp): Promise<void> {
  setup.flow.open();
  setup.refresh();
  await userEvent.click(screen.getByRole('button', { name: row }));
  setup.refresh();
}

function answerSpecies(): void {
  const http = TestBed.inject(HttpTestingController);
  http.match('/api/arten').forEach((request) => {
    request.flush(SPECIES_LIST);
  });
}

describe('EintragenComponent', () => {
  it('zeigt nichts, solange niemand den Plus-Knopf gedrückt hat', async () => {
    const { container } = await build();

    expect(container.querySelector('.addEntry')).toBeNull();
  });

  it('zeigt die drei Aktionen des Plus-Menüs', async () => {
    const setup = await build();

    setup.flow.open();
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Eintragen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fund melden/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marker setzen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zone zeichnen/ })).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('führt vom Fund über das Fadenkreuz ins Formular', async () => {
    const setup = await build();

    await start(setup, /Fund melden/);

    expect(screen.getByRole('heading', { name: 'Fundort festlegen' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundort' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    setup.refresh();
    answerSpecies();
    setup.refresh();

    expect(setup.flow.location()).toEqual([9.05, 48.52]);
    expect(screen.getByRole('heading', { name: 'Fund melden' })).toBeInTheDocument();
  });

  it('speichert einen Fund und schließt den Ablauf', async () => {
    const setup = await build();
    await start(setup, /Fund melden/);
    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    setup.refresh();
    answerSpecies();
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne('/api/funde').flush(FIND);
    });

    await vi.waitFor(() => {
      expect(setup.flow.step()).toBeNull();
    });
    expect(setup.toasts.success).toEqual(['Der Fund ist gespeichert.']);
  });

  it('meldet, wenn die Karte noch keinen Ort hergibt', async () => {
    const setup = await build();
    setup.map.centerPoint = null;
    await start(setup, /Fund melden/);

    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));

    expect(setup.toasts.failure).toEqual(['Die Karte steht noch nicht.']);
    expect(setup.flow.step()).toBe('fundOrt');
  });

  it('speichert einen Marker mit Name, Farbe und Sichtbarkeit', async () => {
    const setup = await build();
    await start(setup, /Marker setzen/);

    expect(screen.getByRole('heading', { name: 'Ort festlegen' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ort übernehmen' }));
    setup.refresh();

    await userEvent.type(screen.getByLabelText('Name'), 'Alter Fichtenhang');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne('/api/marker').flush(MARKER);
    });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Marker ist gespeichert.']);
    });
  });

  it('speichert einen Marker nicht ohne Namen', async () => {
    const setup = await build();
    await start(setup, /Marker setzen/);
    await userEvent.click(screen.getByRole('button', { name: 'Ort übernehmen' }));
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.toasts.failure).toEqual(['Gib dem Marker einen Namen.']);
    setup.http.expectNone('/api/marker');
  });

  it('zählt Eckpunkte und Fläche mit, während die Zone entsteht', async () => {
    const setup = await build();
    await start(setup, /Zone zeichnen/);

    expect(screen.getByRole('heading', { name: 'Zone zeichnen' })).toBeInTheDocument();
    expect(
      screen.getByText('0 Eckpunkte · 0,0 ha. Fadenkreuz auf den nächsten Eckpunkt setzen.'),
    ).toBeInTheDocument();

    setup.map.centerPoint = [9.0, 48.5];
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    setup.map.centerPoint = [9.02, 48.5];
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    setup.map.centerPoint = [9.02, 48.52];
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    setup.refresh();

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText(/^3 Eckpunkte · \d/)).toBeInTheDocument();
    });
  });

  it('nimmt den letzten Eckpunkt wieder weg', async () => {
    const setup = await build();
    await start(setup, /Zone zeichnen/);
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));

    await userEvent.click(screen.getByRole('button', { name: 'Letzten Punkt entfernen' }));

    expect(setup.flow.ring()).toEqual([]);
  });

  it('schließt eine Zone erst ab drei Eckpunkten', async () => {
    const setup = await build();
    await start(setup, /Zone zeichnen/);

    await userEvent.click(screen.getByRole('button', { name: 'Zone abschließen' }));

    expect(setup.toasts.failure).toEqual(['Eine Zone braucht mindestens drei Eckpunkte.']);
  });

  it('speichert eine Zone mit ihrer Fläche', async () => {
    const setup = await build();
    await start(setup, /Zone zeichnen/);
    for (const location of [
      [9.0, 48.5],
      [9.02, 48.5],
      [9.02, 48.52],
    ] as const) {
      setup.map.centerPoint = location;
      await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'Zone abschließen' }));
    setup.refresh();

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne('/api/zonen'));
    expect(
      (request.request.body as { polygon: { coordinates: number[][][] } }).polygon.coordinates[0],
    ).toHaveLength(4);
    request.flush(ZONE);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Die Zone ist gespeichert.']);
    });
  });

  it('stellt einen Fund an, wenn niemand sich anmelden will', async () => {
    const setup = await build();
    setup.auth.reply = false;
    await start(setup, /Fund melden/);
    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    setup.refresh();
    answerSpecies();
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => {
      expect(setup.queue.stored).toEqual(['fund']);
    });
    expect(setup.toasts.success).toEqual(['Der Fund wartet auf die Übertragung.']);
  });

  it('bricht ab und lässt nichts stehen', async () => {
    const setup = await build();
    await start(setup, /Fund melden/);

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.flow.step()).toBeNull();
  });
});
