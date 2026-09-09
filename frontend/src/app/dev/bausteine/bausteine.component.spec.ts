import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { BausteineComponent } from './bausteine.component';

describe('BausteineComponent', () => {
  it('zeigt jeden Baustein in beiden Themes', async () => {
    const { container } = await render(BausteineComponent, { providers: [provideRouter([])] });

    expect(screen.getByRole('heading', { name: 'Bausteine' })).toBeInTheDocument();
    // Jeder Baustein steht zweimal: einmal hell, einmal dunkel.
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche · Hell' })).toBeInTheDocument();
    expect(screen.getAllByRole('tablist')).toHaveLength(2);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getAllByRole('radiogroup', { name: 'Farbe' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(2);
    await keineVerstoesse(container);
    // Die Seite trägt jeden Baustein doppelt; axe braucht dafür mehr als die
    // fünf Sekunden, die eine Prüfung sonst genügen.
  }, 30_000);

  it('legt die Theme-Werte des Kits auf die beiden Felder', async () => {
    const stil = document.createElement('style');
    stil.textContent = ":root[data-theme='light']{--color-bg:#fff}:root[data-theme='dark']{--color-bg:#000}";
    document.head.append(stil);

    const { container } = await render(BausteineComponent, { providers: [provideRouter([])] });
    const felder = container.querySelectorAll<HTMLElement>('.werkstatt__feld');

    expect(felder[0].style.getPropertyValue('--color-bg')).toBe('#fff');
    expect(felder[1].style.getPropertyValue('--color-bg')).toBe('#000');
    stil.remove();
  });
});
