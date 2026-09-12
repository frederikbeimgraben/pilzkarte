import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ColourFieldComponent, paint } from './colour-field.component';

describe('ColourFieldComponent', () => {
  it('zeigt eine Farbe als Fläche und nennt sie für Hilfsmittel', async () => {
    const { container } = await render(ColourFieldComponent, {
      inputs: { colours: [{ name: 'olivbraun', hex: '#7a5c2e' }], label: 'Farbe: olivbraun' },
    });

    const field = screen.getByRole('img', { name: 'Farbe: olivbraun' });
    expect(field).toHaveStyle({ background: '#7a5c2e' });
    await noViolations(container);
  });

  it('teilt mehrere Farben mit harter Kante', () => {
    // Ein Verlauf behauptete Zwischentöne, die die Quelle nicht nennt.
    const fill = paint([
      { name: 'weiß', hex: '#ffffff' },
      { name: 'gelb', hex: '#e8c33a' },
    ]);

    expect(fill).toBe('linear-gradient(104deg,#ffffff 0% 50%,#e8c33a 50% 100%)');
  });

  it('teilt drei Farben in drei gleiche Streifen', () => {
    const fill = paint([
      { name: 'rot', hex: '#c94f3d' },
      { name: 'orange', hex: '#e0a33c' },
      { name: 'braun', hex: '#8a4e2b' },
    ]);

    expect(fill).toMatch(/#e0a33c 33\.33\d*% 66\.66\d*%/);
  });

  it('bleibt ohne Farbe durchsichtig', () => {
    expect(paint([])).toBe('transparent');
  });
});
