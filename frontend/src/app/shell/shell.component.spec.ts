import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
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

function huelle() {
  return render(ShellComponent, { providers: [provideRouter(ROUTEN)] });
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

  it('führt der Avatar zum Konto', async () => {
    const { navigate, fixture } = await huelle();
    await navigate('/karte');

    screen.getByRole('button', { name: 'Konto' }).click();
    await fixture.whenStable();

    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });
});
