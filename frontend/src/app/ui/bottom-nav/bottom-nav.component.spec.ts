import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { BottomNavComponent, type NavItem } from './bottom-nav.component';

const EINTRAEGE: NavItem[] = [
  { path: '/karte', label: 'Karte', icon: 'karte' },
  { path: '/arten', label: 'Arten', icon: 'arten' },
];

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('BottomNavComponent', () => {
  it('zeigt jeden Reiter als Verweis und markiert den aktiven', async () => {
    const { container } = await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, active: '/karte', label: 'Hauptbereiche' },
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Arten' })).not.toHaveAttribute('aria-current');
    await noViolations(container);
  });

  it('markiert nichts, solange kein Reiter aktiv ist', async () => {
    await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, label: 'Hauptbereiche' },
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('link', { name: 'Karte' })).not.toHaveAttribute('aria-current');
  });

  it('tönt beim Tippen nur eine Pille um das Symbol', async () => {
    const { container } = await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, active: '/karte', label: 'Hauptbereiche' },
      providers: [provideRouter([])],
    });

    // Eine Tönung über den ganzen Knopf liefe bis an die Kante der Leiste.
    const areas = container.querySelectorAll('.nav__pill');
    expect(areas).toHaveLength(EINTRAEGE.length);
    const style = styleOf(areas[0]);
    expect(style.borderRadius).toBe('var(--radius-lg)');
    expect(style.padding).toBe('2px 18px');
    expect(style.transition).toBe('background-color 150ms ease-out');
  });

  it('blendet die Markierung des Reiters um, statt sie zu schalten', async () => {
    const { container } = await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, active: '/karte', label: 'Hauptbereiche' },
      providers: [provideRouter([])],
    });

    expect(styleOf(container.querySelector('.nav__entry')).transition).toBe('color 150ms ease-out');
  });

  it('steht am Rechner als Spalte', async () => {
    const { container } = await render(BottomNavComponent, {
      inputs: { eintraege: EINTRAEGE, active: '/karte', label: 'Hauptbereiche', variant: 'spalte' },
      providers: [provideRouter([])],
    });

    expect(container.querySelector('.nav--column')).not.toBeNull();
    // Der Balken unter dem aktiven Reiter blendet mit derselben Zeit um.
    expect(styleOf(container.querySelector('.nav__entry')).transition).toBe(
      'color 150ms ease-out, border-color 150ms ease-out',
    );
  });
});
