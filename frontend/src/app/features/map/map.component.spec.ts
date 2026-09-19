import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { NOW } from '../../core/tiles/now';
import {
  BUNDLE_ITEMS,
  RAW_LAYERS,
  RAW_MANIFEST,
  SAVED_COMBINATION,
  answerManifest,
  mapWithDoubles,
  type MapAdapterDouble,
  type WorkerDouble,
} from '../../testing/map-doubles';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import type { SpeciesEntry } from '../../core/api/models';
import { toastSpy } from '../../testing/toast-spy';
import { SyncService } from '../../core/offline/sync.service';
import { TileService } from '../../core/tiles/tile.service';
import { SpeciesState } from '../species/species.state';
import { CombinationState } from './combination.state';
import { MapComponent } from './map.component';
import { MapState } from './map.state';

@Component({
  selector: 'app-router-stub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class HostComponent {}

@Component({
  selector: 'app-other',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Arten</h1>',
})
class OtherComponent {}

const ROUTES = [
  { path: 'karte', component: MapComponent },
  { path: 'arten', component: OtherComponent },
];

interface Harness {
  double: MapAdapterDouble;
  worker: WorkerDouble;
  stable: () => Promise<void>;
  container: HTMLElement;
  auth: AuthStub;
  net: HttpTestingController;
}

async function map(signedIn = false, items = BUNDLE_ITEMS): Promise<Harness> {
  answerManifest(RAW_MANIFEST, RAW_LAYERS);
  const { map: double, worker } = mapWithDoubles();
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const { fixture, navigate, container } = await render(HostComponent, {
    providers: [
      provideRouter(ROUTES),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...authStubProviders(auth),
      // Ein festes Heute, damit die Wochen der Fixtures gelten.
      { provide: NOW, useValue: () => new Date('2025-10-02T12:00:00Z') },
    ],
  });
  const catalogue = TestBed.inject(SpeciesState) as unknown as {
    species: () => readonly SpeciesEntry[];
  };
  catalogue.species = () => items as unknown as readonly SpeciesEntry[];
  const stable = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await navigate('/karte');
  await stable();
  return { double, worker, stable, container, auth, net: TestBed.inject(HttpTestingController) };
}

/** jsdom kennt keine Ortung; der Test setzt sie am Navigator ein. */
function stubGeolocation(geolocation: Partial<Geolocation>): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
}

describe('MapComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lässt den Kompass weg, solange die Karte nach Norden steht', async () => {
    await map();

    expect(screen.queryByRole('button', { name: 'Nach Norden drehen' })).not.toBeInTheDocument();
  });

  it('zeigt den Kompass mit der Nadel der Drehung, sobald die Karte gedreht ist', async () => {
    const { double, stable, container } = await map();

    double.turnTo(-30);
    await stable();

    const compass = screen.getByRole('button', { name: 'Nach Norden drehen' });
    expect(compass).toBeInTheDocument();
    expect(container.querySelector('.map__compass')).not.toBeNull();
    expect(compass.querySelector('app-svg-icon')).toHaveStyle({ rotate: '30deg' });
  });

  it('zeigt den Kompass auch über einer nur geneigten Karte', async () => {
    const { double, stable } = await map();

    double.turnTo(0, 40);
    await stable();

    expect(screen.getByRole('button', { name: 'Nach Norden drehen' })).toBeInTheDocument();
  });

  it('dreht die Karte auf einen Tipp zurück nach Norden', async () => {
    const { double, stable } = await map();
    double.turnTo(-30);
    await stable();

    await userEvent.click(screen.getByRole('button', { name: 'Nach Norden drehen' }));
    await stable();

    expect(double.norths).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Nach Norden drehen' })).not.toBeInTheDocument();
  });

  it('zeigt Karte, Kopf, Zeitleiste und Legende', async () => {
    const { double, container } = await map();

    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Fundwahrscheinlichkeit je Begehung: 0 % – 50 %/ }),
    ).toBeInTheDocument();
    expect(double.options?.minZoom).toBe(4);
    await noViolations(container);
  });

  it('bittet um eine Art, solange keine eine Vorhersage hat', async () => {
    const { container } = await map(false, []);

    expect(screen.getByRole('button', { name: 'Art wählen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nächste Woche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Zeitleiste' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Fundwahrscheinlichkeit/ })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('nennt die Quelle der Grundkarte am Rand der Karte', async () => {
    const { container } = await map();

    const source = container.querySelector('app-map-attribution');
    expect(source?.textContent).toBe('© OpenStreetMap');
  });

  it('trägt keinen erklärenden Satz', async () => {
    const { container } = await map();

    expect(container.textContent).not.toContain('500 Meter');
    expect(container.textContent).not.toContain('Zelle');
  });

  it('wechselt die Woche über die Zeitleiste', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: /KW 39/ }));
    await stable();

    expect(TestBed.inject(MapState).week()).toBe('2025-39');
  });

  it('geht mit den Pfeilen eine Woche weiter', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    await stable();
    expect(TestBed.inject(MapState).week()).toBe('2025-41');

    await userEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }));
    await stable();
    expect(TestBed.inject(MapState).week()).toBe('2025-40');
  });

  it('macht aus dem Abspielknopf ein Pausensymbol und zurück', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Wochen abspielen' }));
    await stable();
    const pause = screen.getByRole('button', { name: 'Wiedergabe anhalten' });

    await userEvent.click(pause);
    await stable();
    expect(screen.getByRole('button', { name: 'Wochen abspielen' })).toBeInTheDocument();
  });

  it('wechselt den Reiter und hält dabei die Art', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stable();

    expect(TestBed.inject(MapState).view()).toBe('layer');
    expect(TestBed.inject(MapState).species()).toBe('boletus-edulis');
    expect(screen.getAllByRole('button', { name: 'Niederschlag der letzten 4 Wochen' })).toHaveLength(2);
  });

  it('wählt die Art im Kopf und bleibt auf der Karte', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await stable();
    const picker = screen.getByRole('group', { name: 'Art wählen' });
    expect(screen.queryByRole('button', { name: 'Zum Katalog' })).toBeNull();
    await userEvent.click(within(picker).getByRole('button', { name: /Pfifferling/ }));
    await stable();

    expect(TestBed.inject(MapState).species()).toBe('cantharellus-cibarius');
  });

  it('wählt die Ebene über das Feld im Blatt', async () => {
    const { stable } = await map();
    TestBed.inject(MapState).view.set('layer');
    await stable();

    const fields = screen.getAllByRole('button', { name: 'Niederschlag der letzten 4 Wochen' });
    await userEvent.click(fields[fields.length - 1]);
    await stable();
    await userEvent.click(screen.getByRole('button', { name: /Waldanteil/ }));
    await stable();

    expect(TestBed.inject(MapState).layer()).toBe('wald');
  });

  it('legt die Kombination als eine Quelle auf die Karte', async () => {
    const { stable, double } = await map();
    TestBed.inject(MapState).view.set('combination');
    TestBed.inject(CombinationState).apply({
      source: 'wald',
      condition: 'above',
      low: 0.3,
      high: 0,
      active: true,
    });
    await stable();

    expect(double.templates('layer').at(-1)).toContain('combination');
  });

  it('wechselt die Regel der Kombination', async () => {
    const { stable } = await map();
    TestBed.inject(MapState).view.set('combination');
    await stable();

    await userEvent.click(screen.getByRole('tab', { name: 'Abgestuft' }));
    await stable();

    expect(TestBed.inject(CombinationState).rule()).toBe('graded');
  });

  it('fügt einen Faktor hinzu und übernimmt seine Bedingung', async () => {
    const { stable } = await map();
    TestBed.inject(MapState).view.set('combination');
    await stable();

    await userEvent.click(screen.getByRole('button', { name: 'Faktor hinzufügen' }));
    await stable();
    const picker = screen.getByRole('group', { name: 'Faktor wählen' });
    await userEvent.click(within(picker).getByRole('button', { name: /Waldanteil/ }));
    await stable();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await stable();

    expect(TestBed.inject(CombinationState).factors()).toHaveLength(1);
  });

  it('entfernt einen Faktor', async () => {
    const { stable } = await map();
    const combination = TestBed.inject(CombinationState);
    TestBed.inject(MapState).view.set('combination');
    combination.apply({ source: 'wald', condition: 'above', low: 0.3, high: 0, active: true });
    await stable();

    await userEvent.click(screen.getByRole('button', { name: '≥ 30 %' }));
    await stable();
    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));
    await stable();

    expect(combination.factors()).toEqual([]);
  });

  it('bietet ohne Konto zuerst die Anmeldung an', async () => {
    const { stable, auth } = await map();
    const asked = vi.spyOn(auth, 'requestSignIn').mockResolvedValue(false);
    TestBed.inject(MapState).view.set('combination');
    TestBed.inject(CombinationState).apply({
      source: 'wald',
      condition: 'above',
      low: 0.3,
      high: 0,
      active: true,
    });
    await stable();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await stable();

    expect(asked).toHaveBeenCalled();
  });

  it('zeigt die gespeicherten Kombinationen und lädt eine', async () => {
    const { stable } = await map(true);
    const combination = TestBed.inject(CombinationState);
    (combination as unknown as { _saved: { set: (value: unknown) => void } })._saved.set([SAVED_COMBINATION]);
    TestBed.inject(MapState).view.set('combination');
    await stable();

    await userEvent.click(screen.getByRole('button', { name: /Gespeicherte Kombinationen/ }));
    await stable();
    await userEvent.click(screen.getByRole('button', { name: /^Buchenwald im Herbst/ }));
    await stable();

    expect(combination.rule()).toBe('graded');
    expect(combination.factors()[0].source).toBe('wald');
  });

  it('stellt Hintergrund und Deckkraft über den Ebenen-Knopf', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Ebenen' }));
    await stable();
    await userEvent.click(screen.getByRole('tab', { name: 'Hell' }));
    await stable();

    expect(TestBed.inject(MapState).background()).toBe('light');
  });

  it('zentriert auf den Standort und meldet einen Fehlschlag', async () => {
    const { stable, double } = await map();
    stubGeolocation({
      getCurrentPosition: (ok) => {
        ok({ coords: { longitude: 9.1, latitude: 48.7 } } as GeolocationPosition);
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Standort' }));
    await stable();

    expect(double.centered?.point).toEqual([9.1, 48.7]);
  });

  it('sperrt den Standortknopf ohne Freigabe', async () => {
    const { stable } = await map();
    stubGeolocation({});
    await stable();

    expect(screen.getByRole('button', { name: 'Standort' })).toBeInTheDocument();
  });

  it('öffnet mit dem Plus-Knopf das Aktionsblatt', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    await stable();

    expect(screen.getByRole('dialog', { name: 'Eintragen' })).toBeInTheDocument();
  });

  it('zeigt die Leiste ohne Verbindung und lässt die Wochen bedienbar', async () => {
    const { stable } = await map();
    const sync = TestBed.inject(SyncService) as unknown as {
      _online: { set: (value: boolean) => void };
    };
    sync._online.set(false);
    await stable();

    expect(screen.getByRole('status')).toHaveTextContent('Keine Verbindung');
    expect(screen.getByRole('group', { name: 'Zeitleiste' })).not.toHaveClass('bar--dimmed');
  });

  it('zeigt beim Laden das Raster der Karte', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) }),
    );
    const { map: double } = mapWithDoubles();
    const auth = new AuthStub();
    auth.user.set(null);
    const { fixture, navigate, container } = await render(HostComponent, {
      providers: [
        provideRouter(ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...authStubProviders(auth),
        { provide: NOW, useValue: () => new Date('2025-10-02T12:00:00Z') },
      ],
    });
    await navigate('/karte');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(double.started).toBe(1);
    expect(container.querySelector('app-skeleton')).not.toBeNull();
  });

  it('öffnet bei langem Drücken das Objektmenü und zentriert', async () => {
    const { stable, double, container } = await map();
    double.hit = { layer: 'funde', id: 'f1', point: [9.1, 48.7] };
    const canvas = container.querySelector<HTMLElement>('.map__canvas');
    vi.useFakeTimers();
    canvas?.dispatchEvent(new PointerEvent('pointerdown', { clientX: 40, clientY: 60, bubbles: true }));
    await vi.advanceTimersByTimeAsync(600);
    vi.useRealTimers();
    await stable();

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Bearbeiten')).toBeInTheDocument();
    expect(within(menu).getByText('Löschen')).toBeInTheDocument();

    await userEvent.click(within(menu).getByText('Zentrieren'));
    await stable();

    expect(double.centered?.point).toEqual([9.1, 48.7]);
  });

  it('meldet einen Fehlschlag der Ortung', async () => {
    const { stable } = await map();
    stubGeolocation({ getCurrentPosition: (_ok, fail) => fail?.({} as GeolocationPositionError) });

    const toasts = toastSpy();

    await userEvent.click(screen.getByRole('button', { name: 'Standort' }));
    await stable();

    expect(toasts.failure).toEqual(['Kein Standort']);
  });

  it('meldet eine fehlende Ortung des Geräts', async () => {
    const { stable } = await map();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    const toasts = toastSpy();

    await userEvent.click(screen.getByRole('button', { name: 'Standort' }));
    await stable();

    expect(toasts.failure).toEqual(['Kein Standort']);
  });

  it('entfernt einen Faktor über den Knopf in der Zeile', async () => {
    const { stable } = await map();
    const combination = TestBed.inject(CombinationState);
    TestBed.inject(MapState).view.set('combination');
    combination.apply({ source: 'wald', condition: 'above', low: 0.3, high: 0, active: true });
    await stable();

    await userEvent.click(screen.getAllByRole('button', { name: 'Faktor entfernen' })[0]);
    await stable();

    expect(combination.factors()).toEqual([]);
  });

  it('holt die Manifeste neu, wenn die App zurückkommt', async () => {
    const { stable } = await map();
    const forget = vi.spyOn(TestBed.inject(TileService), 'forget');

    document.dispatchEvent(new Event('visibilitychange'));
    await stable();

    expect(forget).toHaveBeenCalled();
  });

  it('schließt ein Blatt über die Abdunkelung', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await stable();
    await userEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    await stable();

    expect(screen.queryByRole('group', { name: 'Art wählen' })).not.toBeInTheDocument();
  });

  it('räumt Karte und Worker beim Verlassen auf', async () => {
    const { double, worker } = await map();

    TestBed.resetTestingModule();

    expect(double.destroyed).toBe(true);
    expect(worker.stopped).toBe(true);
  });
});
