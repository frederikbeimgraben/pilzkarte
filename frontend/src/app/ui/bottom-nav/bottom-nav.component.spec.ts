import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { BottomNavComponent, type NavEintrag } from './bottom-nav.component';

const EINTRAEGE: NavEintrag[] = [
  { pfad: '/karte', label: 'Karte', icon: 'karte' },
  { pfad: '/arten', label: 'Arten', icon: 'arten' },
];

describe('BottomNavComponent', () => {
  it('zeigt jeden Reiter als Verweis und markiert den aktiven', async () => {
    const { container } = await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, aktiv: '/karte', beschriftung: 'Hauptbereiche' },
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Arten' })).not.toHaveAttribute('aria-current');
    await keineVerstoesse(container);
  });

  it('markiert nichts, solange kein Reiter aktiv ist', async () => {
    await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, beschriftung: 'Hauptbereiche' },
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('link', { name: 'Karte' })).not.toHaveAttribute('aria-current');
  });
});
