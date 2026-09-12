import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet, provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SPECIES_LIST, BAY_BOLETE_BRIEF } from '../../testing/species-fixture';
import { NOW } from '../../core/tiles/now';
import {
  RAW_LAYERS,
  SAVED_COMBINATION,
  RAW_MANIFEST,
  mapWithDoubles,
  answerManifest,
  type WorkerDouble,
  type MapAdapterDouble,
} from '../../testing/map-doubles';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '@stupa-makers/ui-kit';
import { TestBed } from '@angular/core/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { AddEntryState } from '../add-entry/add-entry.state';
import { MapComponent } from './map.component';
import { MapState } from './map.state';

/** Die Seite hängt am Router; nur so trägt ihre Adresse die Abfragewerte. */
@Component({
  selector: 'app-host',
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

async function map(
  adresse = '/karte',
  signedIn = false,
): Promise<{
  double: MapAdapterDouble;
  worker: WorkerDouble;
  stable: () => Promise<void>;
  container: HTMLElement;
  auth: AuthStub;
  netz: HttpTestingController;
}> {
  answerManifest();
  const { map: double, worker } = mapWithDoubles();
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const { fixture, navigate, container } = await render(HostComponent, {
    providers: [
      provideRouter(ROUTES),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...authStubProviders(auth),
      // Ein festes Heute: die Karte öffnet auf der laufenden Kalenderwoche,
      // und die Fixtures kennen nur die Wochen 39 bis 41 von 2025.
      { provide: NOW, useValue: () => new Date('2025-10-02T12:00:00Z') },
    ],
  });
  const stable = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await navigate(adresse);
  await stable();
  return { double, worker, stable, container, auth, netz: TestBed.inject(HttpTestingController) };
}

/** jsdom kennt keine Ortung; der Test setzt sie am Navigator ein. */
function stubGeolocation(geolocation: Partial<Geolocation>): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
}

/** Das Beispiel aus dem Konzept als Deep Link; die Kombination beginnt leer. */
/** Der Katalog, wie die Artwahl ihn braucht: mit einer zweiten Art auf Kacheln. */
const KATALOG = {
  ...SPECIES_LIST,
  arten: [
    ...SPECIES_LIST.arten,
    {
      ...BAY_BOLETE_BRIEF,
      slug: 'pfifferling',
      name: 'Pfifferling',
      lateinisch: 'Cantharellus cibarius',
      kartenSlug: 'pfifferling',
    },
  ],
};

const VIER_FAKTOREN =
  '/karte?darstellung=kombination&f=regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3,hangneigung:le:15';

describe('KarteComponent', () => {
  it('zeigt Karte, Blattkopf, Zeitleiste und Legende', async () => {
    const { double, container } = await map();

    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Fundwahrscheinlichkeit je Begehung: 0 % – 50 %/ }),
    ).toBeInTheDocument();
    expect(double.options?.style).toContain('liberty');
    // MapLibre zählt für 512er-Kacheln: die 4 ist die Stufe 5 der Wertkacheln.
    expect(double.options?.minZoom).toBe(4);
    expect(double.options?.maxZoom).toBe(14);
    await noViolations(container);
  });

  it('öffnet auf der laufenden Kalenderwoche', async () => {
    const { double } = await map();

    expect(double.templates().at(-1)).toBe(
      'wert://boletus_edulis/boletus_edulis_kacheln/2025W40/{z}/{x}/{y}',
    );
    expect(screen.queryByText('· Prognose')).not.toBeInTheDocument();
  });

  it('öffnet die Woche aus dem Deep Link und kennzeichnet eine Prognose', async () => {
    const { double } = await map('/karte?art=boletus_edulis&kw=2025-41');

    expect(screen.getByText('KW 41 · 2025')).toBeInTheDocument();
    expect(screen.getByText('· Prognose')).toBeInTheDocument();
    expect(double.templates().at(-1)).toContain('2025W41');
  });

  it('wechselt die Woche per Zeitleiste und schreibt sie in die Adresse', async () => {
    const { double, stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'KW 39 · 2025' }));
    await stable();

    expect(double.templates().at(-1)).toContain('2025W39');
    expect(TestBed.inject(MapState).woche()).toBe('2025-39');
  });

  it('geht mit den Pfeilen eine Woche weiter und bleibt am Rand stehen', async () => {
    const { double, stable } = await map('/karte?kw=2025-41');

    await userEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    await stable();
    const toRight = double.templates().length;

    await userEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }));
    await stable();

    expect(double.templates()).toHaveLength(toRight + 1);
    expect(double.templates().at(-1)).toContain('2025W40');
  });

  it('spielt die Wochen im Takt und hält am Ende an', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { double, stable } = await map('/karte?kw=2025-39');

      screen.getByRole('button', { name: 'Wochen abspielen' }).click();
      await vi.advanceTimersByTimeAsync(1500);
      await stable();

      expect(double.templates().at(-1)).toContain('2025W41');

      await vi.advanceTimersByTimeAsync(1500);
      await stable();

      expect(double.templates().at(-1)).toContain('2025W41');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lädt die Nachbarwochen der sichtbaren Kacheln vor', async () => {
    const { worker } = await map();
    const prefetch = worker.jobs.filter((job) => job.kind === 'vorladen');

    expect(prefetch).not.toHaveLength(0);
    const urls = prefetch[0].urls;
    expect(urls.some((url) => url.includes('2025W41'))).toBe(true);
    expect(urls.some((url) => url.includes('2025W39'))).toBe(true);
    expect(urls.every((url) => url.endsWith('.png'))).toBe(true);
  });

  it('rechnet die Karte auf den freien Streifen über dem Blatt', async () => {
    const { double, stable } = await map();
    const before = double.padding.length;

    await userEvent.click(screen.getByRole('button', { name: 'Blatt greifen' }));
    await stable();

    expect(double.fitted[0].padding.bottom).toBeGreaterThanOrEqual(0);
    expect(double.padding.length).toBeGreaterThan(before);
  });

  it('folgt dem Theme mit dem Hintergrund', async () => {
    const { double, stable } = await map();

    TestBed.inject(ThemeService).setChoice('dunkel');
    await stable();

    expect(double.styles.at(-1)).toContain('dark');
  });

  it('beginnt die Kombination ohne Faktoren', async () => {
    const { double, stable } = await map('/karte?darstellung=kombination');
    await stable();

    expect(screen.getByText('Noch kein Faktor. Füge einen Faktor hinzu.')).toBeInTheDocument();
    expect(double.templatesPerRole.get('ebene')?.at(-1)).toBeNull();
    expect(TestBed.inject(MapState).factors()).toEqual([]);
  });

  it('zeigt die Kombination mit ihren Faktoren', async () => {
    const { container, stable } = await map(VIER_FAKTOREN);
    await stable();

    expect(screen.getByRole('button', { name: 'Kombination' })).toBeInTheDocument();
    const factors = screen.getByRole('group', { name: 'Faktoren' });
    expect(factors).toHaveTextContent('Niederschlag der letzten 4 Wochen');
    expect(factors).toHaveTextContent('≥ 80 mm');
    expect(factors).toHaveTextContent('8 bis 16 Grad');
    expect(screen.getByText(/Wochenbezogene Faktoren beziehen sich auf KW 40 · 2025/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zum Speichern anmelden' })).toBeEnabled();
    await noViolations(container);
  });

  it('legt die Kombination als eine Quelle auf die Karte', async () => {
    const { double, stable } = await map(VIER_FAKTOREN);
    await stable();

    expect(double.templates('ebene').at(-1)).toMatch(/^wert:\/\/kombi\/[0-9a-f]{8}\//);
    expect(double.templatesPerRole.get('vorhersage')?.at(-1)).toBeNull();
  });

  it('wechselt die Regel und zeigt dann eine Rampe', async () => {
    const { double, stable } = await map(VIER_FAKTOREN);
    await stable();
    const before = double.templates('ebene').at(-1);

    await userEvent.click(screen.getByRole('tab', { name: 'Abgestuft' }));
    await stable();

    expect(TestBed.inject(MapState).rule()).toBe('abgestuft');
    expect(double.templates('ebene').at(-1)).not.toBe(before);
    expect(screen.getByRole('img', { name: /Erfüllung der Bedingungen/ })).toBeInTheDocument();
  });

  it('hakt einen Faktor ab und schreibt ihn so in die Adresse', async () => {
    const { stable } = await map(VIER_FAKTOREN);
    await stable();

    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await stable();

    expect(TestBed.inject(MapState).factors()[0].active).toBe(false);
  });

  it('öffnet den Faktor-Screen und zeigt dabei die Ebene selbst', async () => {
    const { double, container, stable } = await map(VIER_FAKTOREN);
    await stable();

    await userEvent.click(screen.getByRole('button', { name: '≥ 80 mm' }));
    await stable();

    expect(screen.getByRole('dialog', { name: 'Faktor' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Verteilung über Deutschland/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Die Bedingung ist auf \d+ % der Fläche Deutschlands erfüllt\./),
    ).toBeInTheDocument();
    expect(double.templates('ebene').at(-1)).toContain('ebene-regen_4w');
    await noViolations(container);
  });

  it('übernimmt eine geänderte Bedingung', async () => {
    const { stable } = await map(VIER_FAKTOREN);
    await stable();
    await userEvent.click(screen.getByRole('button', { name: '≥ 80 mm' }));
    await stable();

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '40' } });
    await stable();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await stable();

    expect(TestBed.inject(MapState).factors()[0].von).toBe(40);
    expect(screen.getByRole('group', { name: 'Faktoren' })).toHaveTextContent('≥ 40 mm');
  });

  it('entfernt einen Faktor', async () => {
    const { stable } = await map(VIER_FAKTOREN);
    await stable();
    await userEvent.click(screen.getByRole('button', { name: '≥ 80 mm' }));
    await stable();

    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));
    await stable();

    expect(
      TestBed.inject(MapState)
        .factors()
        .some((factor) => factor.source === 'regen_4w'),
    ).toBe(false);
    expect(screen.getByRole('group', { name: 'Faktoren' })).not.toHaveTextContent('Niederschlag');
  });

  it('wählt die Art im Blattkopf und bleibt dabei auf der Karte', async () => {
    const { stable, netz } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await stable();
    netz.expectOne('/api/arten').flush(KATALOG);
    await stable();

    expect(screen.getByRole('dialog', { name: 'Art für die Karte' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Pfifferling/ }));
    await stable();

    expect(screen.queryByRole('dialog', { name: 'Art für die Karte' })).not.toBeInTheDocument();
    expect(TestBed.inject(MapState).art()).toBe('pfifferling');
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('führt aus der Artwahl in den Reiter Arten', async () => {
    const { stable, netz } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await stable();
    netz.expectOne('/api/arten').flush(KATALOG);
    await stable();
    await userEvent.click(screen.getByRole('button', { name: 'Alle Arten ansehen' }));
    await stable();

    expect(screen.getByRole('heading', { name: 'Arten' })).toBeInTheDocument();
  });

  it('bietet zum Hinzufügen die Ebenen und die Arten an', async () => {
    const { stable } = await map(VIER_FAKTOREN);
    await stable();

    await userEvent.click(screen.getByRole('button', { name: 'Faktor hinzufügen' }));
    await stable();

    const catalogue = screen.getByRole('group', { name: 'Faktor hinzufügen' });
    expect(catalogue).toHaveTextContent('Arten');
    expect(catalogue).toHaveTextContent('Steinpilz');
    expect(screen.getAllByText('schon dabei').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Boden-pH/ }));
    await stable();

    expect(screen.getByRole('dialog', { name: 'Faktor' })).toBeInTheDocument();
    expect(
      TestBed.inject(MapState)
        .factors()
        .some((factor) => factor.source === 'boden_ph'),
    ).toBe(true);
  });

  it('bleibt ohne Manifest bedienbar', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 404 } as Response));
    const { map: double } = mapWithDoubles();
    const { fixture, container, navigate } = await render(HostComponent, {
      providers: [provideRouter(ROUTES)],
    });
    await navigate('/karte');
    await fixture.whenStable();

    expect(double.templates()).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('öffnet mit dem Plus-Knopf das Aktionsblatt', async () => {
    const { stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    await stable();

    expect(TestBed.inject(AddEntryState).step()).toBe('aktionen');
    expect(screen.getByRole('heading', { name: 'Eintragen' })).toBeInTheDocument();
  });

  it('holt die geteilten Funde des Ausschnitts', async () => {
    await map();
    const http = TestBed.inject(HttpTestingController);

    await vi.waitFor(() => http.expectOne('/api/funde/geteilt?bbox=9.9,50.9,10.9,51.9&limit=200'));
  });

  it('rechnet das Polster auf ein Blatt, das über der Karte liegt', async () => {
    const { double, stable } = await map();
    TestBed.inject(MapState).overlayHeight.set(240);
    await stable();

    expect(double.padding.at(-1)).toEqual({ top: 0, bottom: 240, left: 0, right: 0 });
  });

  it('räumt Karte und Worker beim Verlassen auf', async () => {
    answerManifest(RAW_MANIFEST);
    const { map: double, worker } = mapWithDoubles();
    const { fixture, navigate } = await render(HostComponent, {
      providers: [
        provideRouter(ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...authStubProviders(new AuthStub()),
      ],
    });
    await navigate('/karte');
    await fixture.whenStable();

    fixture.destroy();

    expect(double.destroyed).toBe(true);
    expect(worker.stopped).toBe(true);
  });

  it('zeigt die Ebenen in zwei Gruppen mit ihrer Einheit', async () => {
    const { container, stable } = await map();

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stable();

    expect(screen.getByText('Je Woche')).toBeInTheDocument();
    expect(screen.getByText('Fest')).toBeInTheDocument();
    const catalogue = screen.getByRole('group', { name: 'Eingabe-Ebenen' });
    expect(catalogue).toHaveTextContent('Niederschlag der letzten 4 Wochen');
    expect(catalogue).toHaveTextContent('mm');
    expect(catalogue).toHaveTextContent('Waldanteil');
    await noViolations(container);
  });

  it('legt die gewählte Ebene über die Karte und nennt Rampe und Einheit', async () => {
    const { double, stable } = await map();

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stable();

    expect(double.templates('ebene').at(-1)).toBe(
      'wert://ebene-regen_4w/layers_kacheln/regen_4w/2025W40/{z}/{x}/{y}',
    );
    expect(
      screen.getByRole('img', {
        name: /Niederschlag der letzten 4 Wochen: 0 mm – 152 mm/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Niederschlag der letzten 4 Wochen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('wechselt die Ebene und schreibt sie in die Adresse', async () => {
    const { double, stable } = await map();
    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stable();

    await userEvent.click(screen.getByRole('button', { name: /Boden-pH/ }));
    await stable();

    expect(double.templates('ebene').at(-1)).toBe(
      'wert://ebene-boden_ph/layers_kacheln/boden_ph/{z}/{x}/{y}',
    );
    expect(TestBed.inject(MapState).layer()).toBe('boden_ph');
    expect(screen.getByRole('img', { name: /Boden-pH: 4,7 – 6,9/ })).toBeInTheDocument();
  });

  it('dämpft die Zeitleiste bei einer festen Ebene und sagt warum', async () => {
    const { container, stable } = await map();
    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stable();

    await userEvent.click(screen.getByRole('button', { name: /Waldanteil/ }));
    await stable();

    expect(screen.getByText('Diese Ebene gilt für alle Wochen.')).toBeInTheDocument();
    expect(container.querySelector('.bar--dimmed')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'KW 40 · 2025' })).toBeDisabled();
  });

  it('sagt, wenn die Ebene nicht so weit reicht wie die Zeitleiste', async () => {
    const { stable } = await map('/karte?darstellung=ebene&kw=2025-41');
    await stable();

    expect(
      screen.getByText('Wetterdaten liegen bis KW 40 · 2025 vor. Die Ebene zeigt diese Woche.'),
    ).toBeInTheDocument();
  });

  it('öffnet den Deep Link mit Darstellung, Ebene und Deckkraft', async () => {
    const { double, stable } = await map('/karte?darstellung=ebene&ebene=temperatur&kw=2025-40&deckkraft=70');
    await stable();

    expect(double.templates('ebene').at(-1)).toContain('ebene-temperatur');
    expect(double.opacity.get('ebene')).toBeCloseTo(0.7);
    expect(double.opacity.get('vorhersage')).toBe(1);
    expect(
      screen.getByRole('img', { name: /Mitteltemperatur der Woche: -3,6 Grad – 24,7 Grad/ }),
    ).toBeInTheDocument();
  });

  it('nimmt die Vorhersage weg, solange nur die Ebene gefragt ist', async () => {
    const { double, stable } = await map();
    const before = double.templates().length;

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stable();

    expect(double.templatesPerRole.get('vorhersage')?.at(-1)).toBeNull();
    expect(before).toBeGreaterThan(0);
  });

  it('legt die Vorhersage auf Wunsch unter die Ebene', async () => {
    const { double, stable } = await map('/karte?darstellung=ebene');
    await stable();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte' }));
    await stable();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Vorhersage darunter zeigen' }));
    await stable();

    expect(double.templatesPerRole.get('vorhersage')?.at(-1)).toContain('boletus_edulis');
  });

  it('stellt Hintergrund und Deckkraft über den Ebenen-Knopf', async () => {
    const { double, stable } = await map();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte' }));
    await stable();

    expect(screen.getByText('Topografisch und Satellit kommen später.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    await stable();

    expect(double.styles.at(-1)).toContain('dark');

    const slider = screen.getByRole('slider', { name: 'Deckkraft der Wertebene' });
    fireEvent.input(slider, { target: { value: '40' } });
    await stable();

    expect(double.opacity.get('vorhersage')).toBeCloseTo(0.4);
    expect(TestBed.inject(MapState).opacity()).toBeCloseTo(0.4);
  });

  it('zentriert auf den Standort und meldet einen Fehlschlag', async () => {
    const { double, stable } = await map();
    const fetcher = vi.fn((success: PositionCallback) => {
      success({ coords: { longitude: 9.1, latitude: 48.8 } } as GeolocationPosition);
    });
    stubGeolocation({ getCurrentPosition: fetcher });

    await userEvent.click(screen.getByRole('button', { name: 'Auf meinen Standort' }));
    await stable();

    expect(double.centered?.point).toEqual([9.1, 48.8]);

    stubGeolocation({
      getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => {
        failure({ code: 1 } as GeolocationPositionError);
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Auf meinen Standort' }));
    await stable();

    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toContain('Kein Standort');
  });

  it('macht aus dem Abspielknopf ein Pausensymbol und wieder zurück', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { stable } = await map('/karte?kw=2025-39');

      screen.getByRole('button', { name: 'Wochen abspielen' }).click();
      await stable();

      expect(screen.getByRole('button', { name: 'Wiedergabe anhalten' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      screen.getByRole('button', { name: 'Wiedergabe anhalten' }).click();
      await stable();

      expect(screen.getByRole('button', { name: 'Wochen abspielen' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('sperrt den Standortknopf, wenn die Freigabe abgelehnt ist', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'denied', addEventListener: () => undefined }) },
    });
    const { stable } = await map();
    await vi.waitFor(async () => {
      await stable();
      expect(screen.getByRole('button', { name: 'Auf meinen Standort' })).toBeDisabled();
    });
    Reflect.deleteProperty(navigator, 'permissions');
  });

  it('behält die Ebene aus dem Deep Link, auch wenn `layers.json` später kommt', async () => {
    vi.stubGlobal('fetch', (path: string) =>
      path === '/layers.json'
        ? new Promise<Response>((done) => {
            setTimeout(() => {
              done({ ok: true, status: 200, json: () => Promise.resolve(RAW_LAYERS) } as Response);
            }, 20);
          })
        : Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(RAW_MANIFEST),
          } as Response),
    );
    const { map: double } = mapWithDoubles();
    const { fixture, navigate } = await render(HostComponent, { providers: [provideRouter(ROUTES)] });

    await navigate('/karte?darstellung=ebene&ebene=temperatur');
    await new Promise((done) => setTimeout(done, 60));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(MapState).layer()).toBe('temperatur');
    expect(double.templates('ebene').at(-1)).toContain('ebene-temperatur');
  });

  it('bietet ohne Konto zuerst die Anmeldung an', async () => {
    const { auth, stable } = await map(VIER_FAKTOREN);
    await stable();

    const button = screen.getByRole('button', { name: 'Zum Speichern anmelden' });
    await userEvent.click(button);
    await stable();

    expect(auth.asked).toBe(1);
    expect(screen.getByRole('dialog', { name: 'Kombination speichern' })).toBeInTheDocument();
  });

  it('lässt den Knopf in Ruhe, solange kein Faktor da ist', async () => {
    const { stable } = await map('/karte?darstellung=kombination');
    await stable();

    expect(screen.getByRole('button', { name: 'Zum Speichern anmelden' })).toBeDisabled();
  });

  it('speichert die Kombination unter einem Namen', async () => {
    const { netz, stable } = await map(VIER_FAKTOREN);
    await stable();
    await userEvent.click(screen.getByRole('button', { name: 'Zum Speichern anmelden' }));
    await stable();

    const dialog = screen.getByRole('dialog', { name: 'Kombination speichern' });
    await userEvent.type(screen.getByLabelText(/Name/), 'Buchenwald');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await stable();

    const request = netz.expectOne((query) => query.url === '/api/kombinationen' && query.method === 'POST');
    expect(request.request.body).toEqual({
      name: 'Buchenwald',
      regel: 'schnitt',
      faktoren: [
        { quelle: 'regen_4w', bedingung: 'ueber', von: 80, bis: null, aktiv: true },
        { quelle: 'temperatur', bedingung: 'zwischen', von: 8, bis: 16, aktiv: true },
        { quelle: 'buche', bedingung: 'ueber', von: 0.3, bis: null, aktiv: true },
        { quelle: 'hangneigung', bedingung: 'unter', von: null, bis: 15, aktiv: true },
      ],
    });
    request.flush(SAVED_COMBINATION);
    await stable();
    netz.expectOne('/api/kombinationen').flush({ eintraege: [SAVED_COMBINATION], gesamt: 1 });
    await stable();

    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toContain('Buchenwald');
    expect(screen.queryByRole('dialog', { name: 'Kombination speichern' })).not.toBeInTheDocument();
  });

  it('zeigt die gespeicherten Kombinationen und lädt eine', async () => {
    const { netz, container, stable } = await map('/karte?darstellung=kombination', true);
    netz.expectOne('/api/kombinationen').flush({ eintraege: [SAVED_COMBINATION], gesamt: 1 });
    await stable();

    expect(screen.getByText('Gespeichert')).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Buchenwald im Herbst' }));
    await stable();

    expect(TestBed.inject(MapState).rule()).toBe('abgestuft');
    expect(TestBed.inject(MapState).factors()[0].source).toBe('wald');
    expect(screen.getByRole('group', { name: 'Faktoren' })).toHaveTextContent('≤ 5,5');
  });

  it('löscht eine Kombination erst nach Rückfrage', async () => {
    const { netz, stable } = await map('/karte?darstellung=kombination', true);
    netz.expectOne('/api/kombinationen').flush({ eintraege: [SAVED_COMBINATION], gesamt: 1 });
    await stable();

    await userEvent.click(screen.getByRole('button', { name: '„Buchenwald im Herbst“ löschen' }));
    await stable();

    expect(screen.getByRole('dialog', { name: 'Kombination löschen' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await stable();

    netz.expectOne((query) => query.url === '/api/kombinationen/k1' && query.method === 'DELETE').flush(null);
    await stable();
    netz.expectOne('/api/kombinationen').flush({ eintraege: [], gesamt: 0 });
    await stable();

    expect(screen.queryByText('Gespeichert')).not.toBeInTheDocument();
  });
});
