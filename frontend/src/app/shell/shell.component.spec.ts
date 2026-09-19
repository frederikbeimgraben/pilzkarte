import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { render, screen } from '@testing-library/angular';
import { AuthService } from '../core/auth';
import { PwaService } from '../core/pwa/pwa.service';
import { ViewportService } from '../core/layout/viewport.service';
import { MapRouteComponent } from '../features/map/map-route.component';
import { SyncStub, syncStubProviders } from '../testing/sync-double';
import { ManagerDouble, authProvider, oidcUser } from '../testing/auth-double';
import { mapWithDoubles, answerManifest, type MapAdapterDouble } from '../testing/map-doubles';
import { noViolations } from '../testing/axe';
import { ShellComponent } from './shell.component';

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Seite</h1>',
})
class PageComponent {}

const ROUTES = [
  { path: 'anmeldung', component: PageComponent },
  { path: 'bausteine', component: PageComponent },
  { path: 'karte', component: PageComponent },
  { path: 'arten', component: PageComponent },
  { path: 'arten/:slug', component: PageComponent },
  { path: 'arten/:slug/bilder/:id', component: PageComponent },
  { path: 'eintraege', component: PageComponent },
  { path: 'konto', component: PageComponent },
  { path: 'verwaltung/bilder', component: PageComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

/** Je Test eine eigene Attrappe, sonst trüge eine Anmeldung in den nächsten. */
async function shell(updateReady = false) {
  const manager = new ManagerDouble();
  const sync = new SyncStub();
  const result = await render(ShellComponent, {
    providers: [
      provideRouter(ROUTES),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ...authProvider(manager),
      ...syncStubProviders(sync),
      {
        provide: PwaService,
        useValue: { updateReady: signal(updateReady), activate: () => Promise.resolve() },
      },
    ],
  });
  return { ...result, manager, sync };
}

describe('ShellComponent', () => {
  it('lässt die Leiste auf der Werkstattseite weg', async () => {
    const { navigate } = await shell();

    await navigate('/bausteine');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('lässt die Leiste auf einer Bildseite weg', async () => {
    const { navigate } = await shell();

    await navigate('/arten/boletus-edulis/bilder/eins');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('lässt die Leiste im Prüfstapel weg', async () => {
    const { navigate } = await shell();

    await navigate('/verwaltung/bilder');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('lässt die Leiste auf der Artseite weg', async () => {
    const { navigate } = await shell();

    await navigate('/arten/boletus-edulis');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('behält die Leiste auf der Rückkehr vom SSO und danach', async () => {
    const { navigate } = await shell();

    await navigate('/anmeldung?code=eins&state=zwei');
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();

    await navigate('/konto');
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
  });

  it('behält die Leiste auf dem Reiter Arten', async () => {
    const { navigate } = await shell();

    await navigate('/arten');

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
  });

  it('zeigt die drei Reiter und den Avatar über der Karte', async () => {
    const { container, navigate } = await shell();
    await navigate('/karte');

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
    for (const name of ['Karte', 'Arten', 'Einträge']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Konto' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Aktualisierungsleiste und schiebt den Avatar herab, sobald eine Fassung bereitsteht', async () => {
    const { container, navigate } = await shell(true);
    await navigate('/karte');

    expect(screen.getByRole('status')).toHaveTextContent('Neue Version');
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
    expect(container.querySelector('.shell')).toHaveStyle({
      '--top-bar-height': 'calc(38px + env(safe-area-inset-top, 0px))',
    });
  });

  it('lässt keine Leiste ohne bereitstehende Fassung', async () => {
    await shell(false);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('schiebt den Avatar auch für die eigene Zustandsleiste der Karte herab', async () => {
    const { container, navigate, sync, detectChanges } = await shell();
    await navigate('/karte');
    sync.online.set(false);
    detectChanges();

    expect(container.querySelector('.shell')).toHaveStyle({
      '--top-bar-height': 'calc(38px + env(safe-area-inset-top, 0px))',
    });
    expect(screen.getByRole('button', { name: 'Konto' })).toBeInTheDocument();
  });

  it('lässt die Karte ohne Netz auf einem anderen Reiter ohne Versatz', async () => {
    const { container, navigate, sync, detectChanges } = await shell();
    await navigate('/arten');
    sync.online.set(false);
    detectChanges();

    expect(container.querySelector('.shell')).toHaveStyle({ '--top-bar-height': '0px' });
  });

  it('markiert den Reiter auch bei einer Adresse mit Abfrage', async () => {
    const { navigate } = await shell();

    await navigate('/karte?art=pfifferling&kw=2025-40');

    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
  });

  it('zeigt den Avatar nur über der Karte', async () => {
    const { navigate } = await shell();

    await navigate('/arten');

    expect(screen.getByRole('link', { name: 'Arten' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });

  it('trägt der Avatar angemeldet den ersten Buchstaben des Namens', async () => {
    const { navigate, detectChanges, manager } = await shell();
    await navigate('/karte');
    manager.still = oidcUser();

    await TestBed.inject(AuthService).silentRenew();
    detectChanges();

    expect(screen.getByRole('button', { name: 'Konto von Frederik' })).toHaveTextContent('F');
  });

  it('führt der Avatar zum Konto', async () => {
    const { navigate, fixture } = await shell();
    await navigate('/karte');

    screen.getByRole('button', { name: 'Konto' }).click();
    await fixture.whenStable();

    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });
});

/** Am Rechner steht die Karte in der Hülle; die Route liefert dort nichts. */
const WIDE_ROUTES = [
  { path: 'karte', component: MapRouteComponent },
  { path: 'arten', component: PageComponent },
  { path: 'eintraege', component: PageComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

async function wideShell(): Promise<{
  double: MapAdapterDouble;
  navigate: (path: string) => Promise<boolean>;
  detectChanges: () => void;
  container: Element;
}> {
  answerManifest();
  const { map: double } = mapWithDoubles();
  const { navigate, detectChanges, container, fixture } = await render(ShellComponent, {
    // Die Karte hängt in einem `@defer`-Block, damit sie am Telefon nicht im
    // ersten Bündel liegt. Im Test soll er laufen wie im Browser.
    deferBlockBehavior: DeferBlockBehavior.Playthrough,
    providers: [
      provideRouter(WIDE_ROUTES),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ...authProvider(new ManagerDouble()),
      { provide: ViewportService, useValue: { wide: signal(true) } },
    ],
  });
  await navigate('/karte');
  await fixture.whenStable();
  detectChanges();
  return { double, navigate, detectChanges, container };
}

describe('ShellComponent am Rechner', () => {
  it('stellt die Karte neben die Spalte und lässt sie beim Reiterwechsel stehen', async () => {
    const { double, navigate, detectChanges, container } = await wideShell();

    expect(double.started).toBe(1);
    expect(container.querySelector('.map__column')).not.toBeNull();

    await navigate('/arten');
    detectChanges();
    await navigate('/eintraege');
    detectChanges();

    // Kein zweiter Aufbau heißt: kein Neuladen der Kacheln, kein zweiter Adapter.
    expect(double.started).toBe(1);
    expect(double.destroyed).toBe(false);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('zeigt das Blatt nur auf dem Reiter Karte, die Knöpfe der Karte immer', async () => {
    const { navigate, detectChanges, container } = await wideShell();

    await navigate('/arten');
    detectChanges();

    // Auf einem anderen Reiter gehört die Spalte diesem Reiter. Das Blatt wäre
    // dort verdeckt und läge trotzdem in der Tastaturreihenfolge. Die Knöpfe
    // gehören dagegen der Karte, und die steht rechts weiter offen.
    expect(container.querySelector('.map__sheet')).toBeNull();
    expect(container.querySelector('.map__buttons')).not.toBeNull();
  });
});
