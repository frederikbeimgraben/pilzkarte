import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { ZonenWert } from '../../core/api/models';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { keineVerstoesse } from '../../testing/axe';
import { ZONE } from '../../testing/eintraege-fixture';
import { KartenAttrappe, MANIFEST_ROH } from '../../testing/karte-attrappen';
import { toastSpion, type ToastSpion } from '../../testing/toast-spion';
import { ZeichnerAttrappe, roheKarte, zeichnerAnbieter } from '../../testing/zeichner-attrappe';
import { ZoneBlattComponent } from './zone-blatt.component';

const WERT: ZonenWert = {
  art: 'steinpilz',
  woche: { jahr: 2025, woche: 40 },
  flaechenmittel: 18,
  punkte: 1240,
  eigeneFunde: 2,
};

function anbieter(karte: KartenAttrappe, zeichner: ZeichnerAttrappe): (EnvironmentProviders | Provider)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: KARTE_ADAPTER, useValue: karte },
    ...zeichnerAnbieter(zeichner),
  ];
}

interface Aufbau {
  container: Element;
  http: HttpTestingController;
  toasts: ToastSpion;
  zeichner: ZeichnerAttrappe;
  geschlossen: number;
  aktualisiere: () => void;
}

async function aufbauen(mitKarte = false): Promise<Aufbau> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MANIFEST_ROH) }),
  );
  const karte = new KartenAttrappe();
  if (mitKarte) karte.rohe = roheKarte();
  const zeichner = new ZeichnerAttrappe();
  const { container, detectChanges, fixture } = await render(ZoneBlattComponent, {
    inputs: { zone: ZONE },
    providers: anbieter(karte, zeichner),
  });
  const http = TestBed.inject(HttpTestingController);
  http.match('/api/arten').forEach((anfrage) => {
    anfrage.flush(ARTEN_LISTE);
  });
  detectChanges();
  let geschlossen = 0;
  fixture.componentInstance.geschlossen.subscribe(() => (geschlossen += 1));
  return {
    container,
    http,
    toasts: toastSpion(),
    zeichner,
    aktualisiere: detectChanges,
    get geschlossen() {
      return geschlossen;
    },
  };
}

/** Der Wert der Zone kommt erst, wenn Manifest und Katalog stehen. */
async function wertAntworten(aufbau: Aufbau, wert: ZonenWert | null = WERT): Promise<void> {
  const anfrage = await vi.waitFor(() =>
    aufbau.http.expectOne(`/api/zonen/${ZONE.id}/wert?art=steinpilz&jahr=2025&woche=40`),
  );
  if (wert === null) anfrage.error(new ProgressEvent('error'));
  else anfrage.flush(wert);
  await vi.waitFor(() => {
    aufbau.aktualisiere();
    expect(aufbau.container.querySelectorAll('app-metric-row')).toHaveLength(wert === null ? 0 : 2);
  });
}

describe('ZoneBlattComponent', () => {
  it('zeigt Name, Fläche und Sichtbarkeit in der Unterzeile', async () => {
    const aufbau = await aufbauen();
    await wertAntworten(aufbau);

    expect(screen.getByRole('heading', { name: 'Schönbuch Nord' })).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
    await keineVerstoesse(aufbau.container);
  });

  it('nennt Flächenmittel und eigene Funde mit ihrem Bezug', async () => {
    const aufbau = await aufbauen();
    await wertAntworten(aufbau);

    expect(screen.getByText('Vorhersage Steinpilz, KW 40')).toBeInTheDocument();
    expect(screen.getByText('Flächenmittel, je Begehung')).toBeInTheDocument();
    expect(screen.getByText('18 %')).toBeInTheDocument();
    expect(screen.getByText('Eigene Funde in der Zone')).toBeInTheDocument();
    expect(screen.getByText('alle Arten, alle Jahre')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('sagt es, wenn es für Art und Woche keine Karte gibt', async () => {
    const aufbau = await aufbauen();
    await wertAntworten(aufbau, null);

    expect(screen.getByText('Für diese Art und Woche gibt es keine Karte.')).toBeInTheDocument();
  });

  it('speichert Farbe, Sichtbarkeit und Notiz', async () => {
    const aufbau = await aufbauen();
    await wertAntworten(aufbau);

    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const anfrage = await vi.waitFor(() => aufbau.http.expectOne(`/api/zonen/${ZONE.id}`));
    expect((anfrage.request.body as { sichtbarkeit: string }).sichtbarkeit).toBe('geteilt');
    anfrage.flush(ZONE);

    await vi.waitFor(() => {
      expect(aufbau.toasts.erfolg).toEqual(['Gespeichert.']);
    });
  });

  it('löscht nach der Rückfrage und schließt', async () => {
    const aufbau = await aufbauen();
    await wertAntworten(aufbau);

    await userEvent.click(screen.getByRole('button', { name: 'Zone löschen' }));
    aufbau.aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne(`/api/zonen/${ZONE.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(aufbau.geschlossen).toBe(1);
    });
  });

  it('bleibt stehen, wenn die Karte für Terra Draw fehlt', async () => {
    const aufbau = await aufbauen();
    await wertAntworten(aufbau);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    aufbau.aktualisiere();

    expect(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' })).toBeInTheDocument();
    expect(aufbau.zeichner.ringe).toHaveLength(0);
  });

  it('gibt die Eckpunkte an Terra Draw und speichert, was gezogen wurde', async () => {
    const aufbau = await aufbauen(true);
    await wertAntworten(aufbau);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    await vi.waitFor(() => {
      aufbau.aktualisiere();
      expect(screen.getByText('Eckpunkte mit dem Finger ziehen, dann übernehmen.')).toBeInTheDocument();
    });
    // Der Ring geht ohne den doppelten Endpunkt hinaus.
    expect(aufbau.zeichner.ringe[0]).toHaveLength(4);

    aufbau.zeichner.zieh([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte übernehmen' }));
    const anfrage = await vi.waitFor(() => aufbau.http.expectOne(`/api/zonen/${ZONE.id}`));
    expect(
      (anfrage.request.body as { polygon: { coordinates: number[][][] } }).polygon.coordinates[0],
    ).toHaveLength(4);
    anfrage.flush(ZONE);

    await vi.waitFor(() => {
      expect(aufbau.toasts.erfolg).toEqual(['Gespeichert.']);
    });
    expect(aufbau.zeichner.beendet).toBe(1);
  });

  it('bricht das Bearbeiten der Eckpunkte ab, ohne zu speichern', async () => {
    const aufbau = await aufbauen(true);
    await wertAntworten(aufbau);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    await vi.waitFor(() => {
      aufbau.aktualisiere();
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    aufbau.aktualisiere();

    aufbau.http.expectNone(`/api/zonen/${ZONE.id}`);
    expect(aufbau.zeichner.beendet).toBe(1);
  });

  it('speichert keine Eckpunkte, wenn niemand etwas gezogen hat', async () => {
    const aufbau = await aufbauen(true);
    await wertAntworten(aufbau);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    await vi.waitFor(() => {
      aufbau.aktualisiere();
      expect(screen.getByRole('button', { name: 'Eckpunkte übernehmen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte übernehmen' }));
    aufbau.aktualisiere();

    aufbau.http.expectNone(`/api/zonen/${ZONE.id}`);
  });
});
