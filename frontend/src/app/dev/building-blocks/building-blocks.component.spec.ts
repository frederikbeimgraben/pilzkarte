import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { BuildingBlocksComponent } from './building-blocks.component';

describe('BausteineComponent', () => {
  it('zeigt jeden Baustein in beiden Themes', async () => {
    const { container } = await render(BuildingBlocksComponent, { providers: [provideRouter([])] });

    expect(screen.getByRole('heading', { name: 'Bausteine' })).toBeInTheDocument();
    // Jeder Baustein steht zweimal: einmal hell, einmal dunkel.
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche · Hell' })).toBeInTheDocument();
    expect(screen.getAllByRole('tablist')).toHaveLength(2);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getAllByRole('radiogroup', { name: 'Farbe' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(2);
    await noViolations(container);
    // Die Seite trägt jeden Baustein doppelt; axe braucht dafür mehr als die
    // fünf Sekunden, die eine Prüfung sonst genügen.
  }, 30_000);

  it('legt die Theme-Werte des Kits auf die beiden Felder', async () => {
    const style = document.createElement('style');
    style.textContent = ":root[data-theme='light']{--color-bg:#fff}:root[data-theme='dark']{--color-bg:#000}";
    document.head.append(style);

    const { container } = await render(BuildingBlocksComponent, { providers: [provideRouter([])] });
    const fields = container.querySelectorAll<HTMLElement>('.workshop__field');

    expect(fields[0].style.getPropertyValue('--color-bg')).toBe('#fff');
    expect(fields[1].style.getPropertyValue('--color-bg')).toBe('#000');
    style.remove();
  });
});
