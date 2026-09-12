import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MapState } from '../map/map.state';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Queue } from '../../core/offline/queue';
import type { QueueEntry } from '../../core/offline/queue';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND, SHARED_FIND, MARKER, ZONE, page } from '../../testing/entries-fixture';
import { AuthService } from '../../core/auth';
import { EntriesComponent } from './entries.component';

const PENDING: QueueEntry = {
  id: 'warte-eins',
  art: 'fund',
  body: {
    artSlug: 'maronenroehrling',
    lat: 48.5,
    lon: 9.0,
    datum: '2026-09-10',
    anzahl: 2,
    notiz: 'unter Fichten am Hang',
    sichtbarkeit: 'privat',
  },
  fotos: [],
  erstelltAm: '2026-09-10T08:00:00+02:00',
};

/** Eine Warteschlange mit einem festen Inhalt. */
class QueueStub {
  constructor(private readonly content: readonly QueueEntry[]) {}
  eintraege = (): readonly QueueEntry[] => this.content;
  read(): Promise<readonly QueueEntry[]> {
    return Promise.resolve(this.content);
  }
  send(): Promise<number> {
    return Promise.resolve(0);
  }
}

interface Setup {
  container: Element;
  auth: AuthStub;
  router: Router;
  refresh: () => void;
}

async function build(signedIn = true, pending: readonly QueueEntry[] = [PENDING]): Promise<Setup> {
  vi.setSystemTime(new Date(2026, 8, 10, 12));
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const { container, detectChanges } = await render(EntriesComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Ohne Route ginge jede Navigation ins Leere; der Reiter führt auf die Karte.
      provideRouter([{ path: '**', children: [] }]),
      { provide: Queue, useValue: new QueueStub(pending) },
      ...authStubProviders(auth),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/arten').flush(SPECIES_LIST);
  await vi.waitFor(() => {
    http.expectOne('/api/funde/geteilt?limit=200').flush(page([SHARED_FIND]));
  });
  if (signedIn) {
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(page([FIND]));
    });
    http.expectOne('/api/marker?limit=200').flush(page([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(page([ZONE]));
  }
  const rows = (signedIn ? 1 : 0) + pending.length;
  await vi.waitFor(() => {
    detectChanges();
    expect(container.querySelectorAll('app-list-row').length).toBeGreaterThanOrEqual(rows);
  });
  return { container, auth, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('EintraegeComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Kopfzeile, Chips und die eigenen Funde', async () => {
    const setup = await build();

    expect(screen.getByRole('heading', { name: 'Einträge' })).toBeInTheDocument();
    for (const chip of ['Funde', 'Marker', 'Zonen', 'Geteilt']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    const row = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(row).getByText('6. Sept. · 3 Stück · Frederik')).toBeInTheDocument();
    expect(within(row).getByText('Geteilt')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('stellt einen wartenden Fund mit seinem Kennzeichen nach oben', async () => {
    const setup = await build();

    // Ein wartender Eintrag hat noch keine Kennung vom Dienst: er lässt sich
    // nicht öffnen und ist darum kein Knopf.
    const rows = setup.container.querySelectorAll('app-list-row');
    expect(rows[0]).toHaveTextContent('Maronenröhrling');
    expect(rows[0]).toHaveTextContent('Heute · 2 Stück · Frederik');
    expect(rows[0]).toHaveTextContent('Übertragung ausstehend');
    expect(rows[0].querySelector('button')).toBeNull();
  });

  it('wechselt auf Marker und Zonen', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Marker' }));
    setup.refresh();
    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();
    expect(screen.getByText('Marker · privat')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zonen' }));
    setup.refresh();
    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
  });

  it('zeigt unter „geteilt“ auch fremde Funde ohne Blatt', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Geteilt' }));
    setup.refresh();

    expect(screen.getByText('Maronenröhrling')).toBeInTheDocument();
    expect(screen.getByText('4. Sept. · 5 Stück · Jonas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maronenröhrling/ })).not.toBeInTheDocument();
  });

  it('öffnet einen Eintrag über der Karte', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    await vi.waitFor(() => {
      expect(TestBed.inject(MapState).object()).toEqual({ art: 'fund', id: FIND.id });
    });
  });

  it('bittet ohne Konto um eine Anmeldung', async () => {
    const setup = await build(false, []);

    expect(
      screen.getByText('Eigene Einträge stehen im Konto. Zum Lesen ist eine Anmeldung nötig.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zonen' }));
    setup.refresh();
    expect(
      screen.getByText('Eigene Einträge stehen im Konto. Zum Lesen ist eine Anmeldung nötig.'),
    ).toBeInTheDocument();
  });

  it('führt aus dem Leerzustand zur Anmeldung', async () => {
    await build(false, []);
    const auth = TestBed.inject(AuthService);
    const asked = vi.spyOn(auth, 'requestSignIn').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('bietet unter „geteilt“ keine Anmeldung an, dort liest jeder mit', async () => {
    const setup = await build(false, []);

    await userEvent.click(screen.getByRole('button', { name: 'Geteilt' }));
    setup.refresh();

    expect(screen.queryByRole('button', { name: 'Anmelden' })).not.toBeInTheDocument();
  });
});
