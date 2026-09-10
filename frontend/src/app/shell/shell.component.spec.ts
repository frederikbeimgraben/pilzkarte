import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthService } from '../core/auth';
import { AnsichtDienst } from '../core/layout/ansicht.service';
import { KartenRouteComponent } from '../features/karte/karten-route.component';
import { ManagerAttrappe, authAnbieter, oidcNutzer } from '../testing/auth-attrappe';
import { karteMitAttrappen, manifestAntwort, type KartenAttrappe } from '../testing/karte-attrappen';
import { keineVerstoesse } from '../testing/axe';
import { ShellComponent } from './shell.component';

@Component({
  selector: 'app-seite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Seite</h1>',
})
class SeiteComponent {}

const ROUTEN = [
  { path: 'karte', component: SeiteComponent },
  { path: 'arten', component: SeiteComponent },
  { path: 'eintraege', component: SeiteComponent },
  { path: 'konto', component: SeiteComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

/** Je Test eine eigene Attrappe, sonst trüge eine Anmeldung in den nächsten. */
async function huelle() {
  const manager = new ManagerAttrappe();
  const ergebnis = await render(ShellComponent, {
    providers: [provideRouter(ROUTEN), ...authAnbieter(manager)],
  });
  return { ...ergebnis, manager };
}

describe('ShellComponent', () => {
  it('zeigt die drei Reiter und den Avatar über der Karte', async () => {
    const { container, navigate } = await huelle();
    await navigate('/karte');

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
    for (const name of ['Karte', 'Arten', 'Einträge']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Konto' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('markiert den Reiter auch bei einer Adresse mit Abfrage', async () => {
    const { navigate } = await huelle();

    await navigate('/karte?art=pfifferling&kw=2025-40');

    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
  });

  it('zeigt den Avatar nur über der Karte', async () => {
    const { navigate } = await huelle();

    await navigate('/arten');

    expect(screen.getByRole('link', { name: 'Arten' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });

  it('trägt der Avatar angemeldet den ersten Buchstaben des Namens', async () => {
    const { navigate, detectChanges, manager } = await huelle();
    await navigate('/karte');
    manager.still = oidcNutzer();

    await TestBed.inject(AuthService).stilleErneuerung();
    detectChanges();

    expect(screen.getByRole('button', { name: 'Konto von Frederik' })).toHaveTextContent('F');
  });

  it('führt der Avatar zum Konto', async () => {
    const { navigate, fixture } = await huelle();
    await navigate('/karte');

    screen.getByRole('button', { name: 'Konto' }).click();
    await fixture.whenStable();

    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });
});

/** Am Rechner steht die Karte in der Hülle; die Route liefert dort nichts. */
const BREITE_ROUTEN = [
  { path: 'karte', component: KartenRouteComponent },
  { path: 'arten', component: SeiteComponent },
  { path: 'eintraege', component: SeiteComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

async function breiteHuelle(): Promise<{
  attrappe: KartenAttrappe;
  navigate: (pfad: string) => Promise<boolean>;
  detectChanges: () => void;
  container: Element;
}> {
  manifestAntwort();
  const { karte: attrappe } = karteMitAttrappen();
  const { navigate, detectChanges, container, fixture } = await render(ShellComponent, {
    // Die Karte hängt in einem `@defer`-Block, damit sie am Telefon nicht im
    // ersten Bündel liegt. Im Test soll er laufen wie im Browser.
    deferBlockBehavior: DeferBlockBehavior.Playthrough,
    providers: [
      provideRouter(BREITE_ROUTEN),
      ...authAnbieter(new ManagerAttrappe()),
      { provide: AnsichtDienst, useValue: { breit: signal(true) } },
    ],
  });
  await navigate('/karte');
  await fixture.whenStable();
  detectChanges();
  return { attrappe, navigate, detectChanges, container };
}

describe('ShellComponent am Rechner', () => {
  it('stellt die Karte neben die Spalte und lässt sie beim Reiterwechsel stehen', async () => {
    const { attrappe, navigate, detectChanges, container } = await breiteHuelle();

    expect(attrappe.gestartet).toBe(1);
    expect(container.querySelector('.karte__blatt')).not.toBeNull();

    await navigate('/arten');
    detectChanges();
    await navigate('/eintraege');
    detectChanges();

    // Kein zweiter Aufbau heißt: kein Neuladen der Kacheln, kein zweiter Adapter.
    expect(attrappe.gestartet).toBe(1);
    expect(attrappe.zerstoert).toBe(false);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('zeigt das Blatt nur auf dem Reiter Karte', async () => {
    const { navigate, detectChanges, container } = await breiteHuelle();

    await navigate('/arten');
    detectChanges();

    // Auf einem anderen Reiter gehört die Spalte diesem Reiter. Das Blatt wäre
    // dort verdeckt und läge trotzdem in der Tastaturreihenfolge.
    expect(container.querySelector('.karte__blatt')).toBeNull();
    expect(container.querySelector('.karte__knoepfe')).toBeNull();
  });
});
