import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthService } from '../core/auth';
import { ViewportService } from '../core/layout/viewport.service';
import { MapRouteComponent } from '../features/map/map-route.component';
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
  { path: 'karte', component: PageComponent },
  { path: 'arten', component: PageComponent },
  { path: 'eintraege', component: PageComponent },
  { path: 'konto', component: PageComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

/** Je Test eine eigene Attrappe, sonst trüge eine Anmeldung in den nächsten. */
async function shell() {
  const manager = new ManagerDouble();
  const result = await render(ShellComponent, {
    providers: [provideRouter(ROUTES), ...authProvider(manager)],
  });
  return { ...result, manager };
}

describe('ShellComponent', () => {
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
    expect(container.querySelector('.map__sheet')).not.toBeNull();

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
