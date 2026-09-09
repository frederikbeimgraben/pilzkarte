import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { SeasonCurveComponent } from './season-curve.component';

const ALLE = Array.from({ length: 52 }, (_, i) => i / 51);
const LAUFEND = Array.from({ length: 20 }, (_, i) => i / 51);

describe('SeasonCurveComponent', () => {
  it('zeichnet die kleine Kurve mit Beschriftung', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: LAUFEND, beschriftung: 'Saisonkurve' },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 88 36');
    await keineVerstoesse(container);
  });

  it('zeichnet die große Kurve mit Achse und Legende', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: LAUFEND,
        beschriftung: 'Saisonkurve',
        gross: true,
        achse: '32 %',
        legendeLaufend: '2025 bis KW 39',
        legendeJahre: '2015 bis 2024',
      },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 330 72');
    expect(screen.getByText('32 %')).toBeInTheDocument();
    expect(screen.getByText('2025 bis KW 39')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('bleibt ohne Werte auf der Grundlinie', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: [], laufendesJahr: [], beschriftung: 'Saisonkurve' },
    });

    expect(container.querySelector('.funke__ende')).toHaveAttribute('cy', '36');
  });
});
