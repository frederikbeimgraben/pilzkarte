import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Warteschlange } from '../../core/offline/warteschlange';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { keineVerstoesse } from '../../testing/axe';
import { FUND, MARKER, ZONE } from '../../testing/eintraege-fixture';
import { KartenAttrappe } from '../../testing/karte-attrappen';
import { toastSpion, type ToastSpion } from '../../testing/toast-spion';
import { EintragenComponent } from './eintragen.component';
import { EintragenZustand } from './eintragen.zustand';

/** Eine Warteschlange ohne IndexedDB. */
class WarteStummel {
  readonly abgelegt: string[] = [];
  eintraege = (): [] => [];
  lege(art: string): Promise<{ id: string }> {
    this.abgelegt.push(art);
    return Promise.resolve({ id: 'w-1' });
  }
  lies(): Promise<[]> {
    return Promise.resolve([]);
  }
  sende(): Promise<number> {
    return Promise.resolve(0);
  }
}

interface Aufbau {
  container: Element;
  ablauf: EintragenZustand;
  karte: KartenAttrappe;
  auth: AuthStummel;
  warteschlange: WarteStummel;
  http: HttpTestingController;
  toasts: ToastSpion;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  const karte = new KartenAttrappe();
  const auth = new AuthStummel();
  const warteschlange = new WarteStummel();
  const { container, detectChanges } = await render(EintragenComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: KARTE_ADAPTER, useValue: karte },
      { provide: Warteschlange, useValue: warteschlange },
      ...authStummelAnbieter(auth),
    ],
  });
  return {
    container,
    ablauf: TestBed.inject(EintragenZustand),
    karte,
    auth,
    warteschlange,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpion(),
    aktualisiere: detectChanges,
  };
}

/** Das Aktionsblatt öffnen und dort eine Zeile wählen. */
async function starte(aufbau: Aufbau, zeile: RegExp): Promise<void> {
  aufbau.ablauf.oeffne();
  aufbau.aktualisiere();
  await userEvent.click(screen.getByRole('button', { name: zeile }));
  aufbau.aktualisiere();
}

function artenAntworten(): void {
  const http = TestBed.inject(HttpTestingController);
  http.match('/api/arten').forEach((anfrage) => {
    anfrage.flush(ARTEN_LISTE);
  });
}

describe('EintragenComponent', () => {
  it('zeigt nichts, solange niemand den Plus-Knopf gedrückt hat', async () => {
    const { container } = await aufbauen();

    expect(container.querySelector('.eintragen')).toBeNull();
  });

  it('zeigt die drei Aktionen des Plus-Menüs', async () => {
    const aufbau = await aufbauen();

    aufbau.ablauf.oeffne();
    aufbau.aktualisiere();

    expect(screen.getByRole('heading', { name: 'Eintragen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fund melden/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marker setzen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zone zeichnen/ })).toBeInTheDocument();
    await keineVerstoesse(aufbau.container);
  });

  it('führt vom Fund über das Fadenkreuz ins Formular', async () => {
    const aufbau = await aufbauen();

    await starte(aufbau, /Fund melden/);

    expect(screen.getByRole('heading', { name: 'Fundort festlegen' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundort' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    aufbau.aktualisiere();
    artenAntworten();
    aufbau.aktualisiere();

    expect(aufbau.ablauf.ort()).toEqual([9.05, 48.52]);
    expect(screen.getByRole('heading', { name: 'Fund melden' })).toBeInTheDocument();
  });

  it('speichert einen Fund und schließt den Ablauf', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Fund melden/);
    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    aufbau.aktualisiere();
    artenAntworten();
    aufbau.aktualisiere();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne('/api/funde').flush(FUND);
    });

    await vi.waitFor(() => {
      expect(aufbau.ablauf.schritt()).toBeNull();
    });
    expect(aufbau.toasts.erfolg).toEqual(['Der Fund ist gespeichert.']);
  });

  it('meldet, wenn die Karte noch keinen Ort hergibt', async () => {
    const aufbau = await aufbauen();
    aufbau.karte.zentrum = null;
    await starte(aufbau, /Fund melden/);

    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));

    expect(aufbau.toasts.fehler).toEqual(['Die Karte steht noch nicht.']);
    expect(aufbau.ablauf.schritt()).toBe('fundOrt');
  });

  it('speichert einen Marker mit Name, Farbe und Sichtbarkeit', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Marker setzen/);

    expect(screen.getByRole('heading', { name: 'Ort festlegen' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ort übernehmen' }));
    aufbau.aktualisiere();

    await userEvent.type(screen.getByLabelText('Name'), 'Alter Fichtenhang');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne('/api/marker').flush(MARKER);
    });

    await vi.waitFor(() => {
      expect(aufbau.toasts.erfolg).toEqual(['Der Marker ist gespeichert.']);
    });
  });

  it('speichert einen Marker nicht ohne Namen', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Marker setzen/);
    await userEvent.click(screen.getByRole('button', { name: 'Ort übernehmen' }));
    aufbau.aktualisiere();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.toasts.fehler).toEqual(['Gib dem Marker einen Namen.']);
    aufbau.http.expectNone('/api/marker');
  });

  it('zählt Eckpunkte und Fläche mit, während die Zone entsteht', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Zone zeichnen/);

    expect(screen.getByRole('heading', { name: 'Zone zeichnen' })).toBeInTheDocument();
    expect(
      screen.getByText('0 Eckpunkte · 0,0 ha. Fadenkreuz auf den nächsten Eckpunkt setzen.'),
    ).toBeInTheDocument();

    aufbau.karte.zentrum = [9.0, 48.5];
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    aufbau.karte.zentrum = [9.02, 48.5];
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    aufbau.karte.zentrum = [9.02, 48.52];
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    aufbau.aktualisiere();

    await vi.waitFor(() => {
      aufbau.aktualisiere();
      expect(screen.getByText(/^3 Eckpunkte · \d/)).toBeInTheDocument();
    });
  });

  it('nimmt den letzten Eckpunkt wieder weg', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Zone zeichnen/);
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));

    await userEvent.click(screen.getByRole('button', { name: 'Letzten Punkt entfernen' }));

    expect(aufbau.ablauf.ring()).toEqual([]);
  });

  it('schließt eine Zone erst ab drei Eckpunkten', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Zone zeichnen/);

    await userEvent.click(screen.getByRole('button', { name: 'Zone abschließen' }));

    expect(aufbau.toasts.fehler).toEqual(['Eine Zone braucht mindestens drei Eckpunkte.']);
  });

  it('speichert eine Zone mit ihrer Fläche', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Zone zeichnen/);
    for (const ort of [
      [9.0, 48.5],
      [9.02, 48.5],
      [9.02, 48.52],
    ] as const) {
      aufbau.karte.zentrum = ort;
      await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'Zone abschließen' }));
    aufbau.aktualisiere();

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const anfrage = await vi.waitFor(() => aufbau.http.expectOne('/api/zonen'));
    expect(
      (anfrage.request.body as { polygon: { coordinates: number[][][] } }).polygon.coordinates[0],
    ).toHaveLength(4);
    anfrage.flush(ZONE);

    await vi.waitFor(() => {
      expect(aufbau.toasts.erfolg).toEqual(['Die Zone ist gespeichert.']);
    });
  });

  it('stellt einen Fund an, wenn niemand sich anmelden will', async () => {
    const aufbau = await aufbauen();
    aufbau.auth.antwort = false;
    await starte(aufbau, /Fund melden/);
    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    aufbau.aktualisiere();
    artenAntworten();
    aufbau.aktualisiere();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => {
      expect(aufbau.warteschlange.abgelegt).toEqual(['fund']);
    });
    expect(aufbau.toasts.erfolg).toEqual(['Der Fund wartet auf die Übertragung.']);
  });

  it('bricht ab und lässt nichts stehen', async () => {
    const aufbau = await aufbauen();
    await starte(aufbau, /Fund melden/);

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(aufbau.ablauf.schritt()).toBeNull();
  });
});
