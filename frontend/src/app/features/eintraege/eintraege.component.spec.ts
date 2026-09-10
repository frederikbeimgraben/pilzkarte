import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Warteschlange } from '../../core/offline/warteschlange';
import type { WarteEintrag } from '../../core/offline/warteschlange';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { keineVerstoesse } from '../../testing/axe';
import { FUND, GETEILTER_FUND, MARKER, ZONE, seite } from '../../testing/eintraege-fixture';
import { EintragenZustand } from '../eintragen/eintragen.zustand';
import { EintraegeComponent } from './eintraege.component';

const WARTEND: WarteEintrag = {
  id: 'warte-eins',
  art: 'fund',
  koerper: {
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
class WarteStummel {
  constructor(private readonly inhalt: readonly WarteEintrag[]) {}
  eintraege = (): readonly WarteEintrag[] => this.inhalt;
  lies(): Promise<readonly WarteEintrag[]> {
    return Promise.resolve(this.inhalt);
  }
  sende(): Promise<number> {
    return Promise.resolve(0);
  }
}

interface Aufbau {
  container: Element;
  auth: AuthStummel;
  router: Router;
  aktualisiere: () => void;
}

async function aufbauen(angemeldet = true, wartend: readonly WarteEintrag[] = [WARTEND]): Promise<Aufbau> {
  vi.setSystemTime(new Date(2026, 8, 10, 12));
  const auth = new AuthStummel();
  if (!angemeldet) auth.nutzer.set(null);
  const { container, detectChanges } = await render(EintraegeComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Ohne Route ginge jede Navigation ins Leere; der Reiter führt auf die Karte.
      provideRouter([{ path: '**', children: [] }]),
      { provide: Warteschlange, useValue: new WarteStummel(wartend) },
      ...authStummelAnbieter(auth),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/arten').flush(ARTEN_LISTE);
  await vi.waitFor(() => {
    http.expectOne('/api/funde/geteilt?limit=200').flush(seite([GETEILTER_FUND]));
  });
  if (angemeldet) {
    await vi.waitFor(() => {
      http.expectOne('/api/funde?limit=200').flush(seite([FUND]));
    });
    http.expectOne('/api/marker?limit=200').flush(seite([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(seite([ZONE]));
  }
  const zeilen = (angemeldet ? 1 : 0) + wartend.length;
  await vi.waitFor(() => {
    detectChanges();
    expect(container.querySelectorAll('app-list-row').length).toBeGreaterThanOrEqual(zeilen);
  });
  return { container, auth, router: TestBed.inject(Router), aktualisiere: detectChanges };
}

describe('EintraegeComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Kopfzeile, Chips und die eigenen Funde', async () => {
    const aufbau = await aufbauen();

    expect(screen.getByRole('heading', { name: 'Einträge' })).toBeInTheDocument();
    for (const chip of ['Funde', 'Marker', 'Zonen', 'geteilt']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    const zeile = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(zeile).getByText('6. Sept. · 3 Stück · Frederik')).toBeInTheDocument();
    expect(within(zeile).getByText('geteilt')).toBeInTheDocument();
    await keineVerstoesse(aufbau.container);
  });

  it('stellt einen wartenden Fund mit seinem Kennzeichen nach oben', async () => {
    const aufbau = await aufbauen();

    // Ein wartender Eintrag hat noch keine Kennung vom Dienst: er lässt sich
    // nicht öffnen und ist darum kein Knopf.
    const zeilen = aufbau.container.querySelectorAll('app-list-row');
    expect(zeilen[0]).toHaveTextContent('Maronenröhrling');
    expect(zeilen[0]).toHaveTextContent('Heute · 2 Stück · Frederik');
    expect(zeilen[0]).toHaveTextContent('Übertragung ausstehend');
    expect(zeilen[0].querySelector('button')).toBeNull();
  });

  it('wechselt auf Marker und Zonen', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Marker' }));
    aufbau.aktualisiere();
    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();
    expect(screen.getByText('Marker · privat')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zonen' }));
    aufbau.aktualisiere();
    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
  });

  it('zeigt unter „geteilt“ auch fremde Funde ohne Blatt', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'geteilt' }));
    aufbau.aktualisiere();

    expect(screen.getByText('Maronenröhrling')).toBeInTheDocument();
    expect(screen.getByText('4. Sept. · 5 Stück · Jonas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maronenröhrling/ })).not.toBeInTheDocument();
  });

  it('öffnet einen Eintrag über der Karte', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    await vi.waitFor(() => {
      expect(aufbau.router.url).toContain(`objekt=fund:${FUND.id}`);
    });
  });

  it('führt vom Plus-Knopf auf die Karte und öffnet das Menü', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: /Eintragen/ }));

    await vi.waitFor(() => {
      expect(aufbau.router.url).toBe('/karte');
    });
    expect(TestBed.inject(EintragenZustand).schritt()).toBe('aktionen');
  });

  it('bittet ohne Konto um eine Anmeldung', async () => {
    const aufbau = await aufbauen(false, []);

    expect(
      screen.getByText('Eigene Einträge stehen im Konto. Zum Lesen ist eine Anmeldung nötig.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zonen' }));
    aufbau.aktualisiere();
    expect(
      screen.getByText('Eigene Einträge stehen im Konto. Zum Lesen ist eine Anmeldung nötig.'),
    ).toBeInTheDocument();
  });
});
