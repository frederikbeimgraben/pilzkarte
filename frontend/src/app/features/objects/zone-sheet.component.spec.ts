import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { ZoneValue } from '../../core/api/models';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { ZONE } from '../../testing/entries-fixture';
import { MapAdapterDouble, RAW_MANIFEST } from '../../testing/map-doubles';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { DrawerDouble, rawMap, drawerProviders } from '../../testing/drawer-double';
import { ZoneSheetComponent } from './zone-sheet.component';

const VALUE: ZoneValue = {
  art: 'steinpilz',
  woche: { jahr: 2025, woche: 40 },
  flaechenmittel: 18,
  punkte: 1240,
  eigeneFunde: 2,
};

function provider(map: MapAdapterDouble, drawer: DrawerDouble): (EnvironmentProviders | Provider)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: MAP_ADAPTER, useValue: map },
    ...drawerProviders(drawer),
  ];
}

interface Setup {
  container: Element;
  http: HttpTestingController;
  toasts: ToastSpy;
  drawer: DrawerDouble;
  closed: number;
  refresh: () => void;
}

async function build(withMap = false): Promise<Setup> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(RAW_MANIFEST) }),
  );
  const map = new MapAdapterDouble();
  if (withMap) map.raw = rawMap();
  const drawer = new DrawerDouble();
  const { container, detectChanges, fixture } = await render(ZoneSheetComponent, {
    inputs: { zone: ZONE },
    providers: provider(map, drawer),
  });
  const http = TestBed.inject(HttpTestingController);
  http.match('/api/arten').forEach((request) => {
    request.flush(SPECIES_LIST);
  });
  detectChanges();
  let closed = 0;
  fixture.componentInstance.closed.subscribe(() => (closed += 1));
  return {
    container,
    http,
    toasts: toastSpy(),
    drawer,
    refresh: detectChanges,
    get closed() {
      return closed;
    },
  };
}

/** Der Wert der Zone kommt erst, wenn Manifest und Katalog stehen. */
async function answerValue(setup: Setup, value: ZoneValue | null = VALUE): Promise<void> {
  const request = await vi.waitFor(() =>
    setup.http.expectOne(`/api/zonen/${ZONE.id}/wert?art=steinpilz&jahr=2025&woche=40`),
  );
  if (value === null) request.error(new ProgressEvent('error'));
  else request.flush(value);
  await vi.waitFor(() => {
    setup.refresh();
    expect(setup.container.querySelectorAll('app-metric-row')).toHaveLength(value === null ? 0 : 2);
  });
}

describe('ZoneBlattComponent', () => {
  it('zeigt Name, Fläche und Sichtbarkeit in der Unterzeile', async () => {
    const setup = await build();
    await answerValue(setup);

    expect(screen.getByRole('heading', { name: 'Schönbuch Nord' })).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('nennt Flächenmittel und eigene Funde mit ihrem Bezug', async () => {
    const setup = await build();
    await answerValue(setup);

    expect(screen.getByText('Vorhersage Steinpilz, KW 40')).toBeInTheDocument();
    expect(screen.getByText('Flächenmittel, je Begehung')).toBeInTheDocument();
    expect(screen.getByText('18 %')).toBeInTheDocument();
    expect(screen.getByText('Eigene Funde in der Zone')).toBeInTheDocument();
    expect(screen.getByText('alle Arten, alle Jahre')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('sagt es, wenn es für Art und Woche keine Karte gibt', async () => {
    const setup = await build();
    await answerValue(setup, null);

    expect(screen.getByText('Für diese Art und Woche gibt es keine Karte.')).toBeInTheDocument();
  });

  it('speichert Farbe, Sichtbarkeit und Notiz', async () => {
    const setup = await build();
    await answerValue(setup);

    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/zonen/${ZONE.id}`));
    expect((request.request.body as { sichtbarkeit: string }).sichtbarkeit).toBe('geteilt');
    request.flush(ZONE);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Gespeichert.']);
    });
  });

  it('löscht nach der Rückfrage und schließt', async () => {
    const setup = await build();
    await answerValue(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Zone löschen' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/zonen/${ZONE.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.closed).toBe(1);
    });
  });

  it('bleibt stehen, wenn die Karte für Terra Draw fehlt', async () => {
    const setup = await build();
    await answerValue(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    setup.refresh();

    expect(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' })).toBeInTheDocument();
    expect(setup.drawer.rings).toHaveLength(0);
  });

  it('gibt die Eckpunkte an Terra Draw und speichert, was gezogen wurde', async () => {
    const setup = await build(true);
    await answerValue(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText('Eckpunkte mit dem Finger ziehen, dann übernehmen.')).toBeInTheDocument();
    });
    // Der Ring geht ohne den doppelten Endpunkt hinaus.
    expect(setup.drawer.rings[0]).toHaveLength(4);

    setup.drawer.drag([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte übernehmen' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/zonen/${ZONE.id}`));
    expect(
      (request.request.body as { polygon: { coordinates: number[][][] } }).polygon.coordinates[0],
    ).toHaveLength(4);
    request.flush(ZONE);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Gespeichert.']);
    });
    expect(setup.drawer.stopped).toBe(1);
  });

  it('bricht das Bearbeiten der Eckpunkte ab, ohne zu speichern', async () => {
    const setup = await build(true);
    await answerValue(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    setup.refresh();

    setup.http.expectNone(`/api/zonen/${ZONE.id}`);
    expect(setup.drawer.stopped).toBe(1);
  });

  it('speichert keine Eckpunkte, wenn niemand etwas gezogen hat', async () => {
    const setup = await build(true);
    await answerValue(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte bearbeiten' }));
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Eckpunkte übernehmen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte übernehmen' }));
    setup.refresh();

    setup.http.expectNone(`/api/zonen/${ZONE.id}`);
  });
});
