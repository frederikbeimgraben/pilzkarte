import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { HistogramComponent } from './histogram.component';

describe('HistogramComponent', () => {
  it('zeichnet je Klasse einen Balken', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { anteile: [1, 2, 3, 4], beschriftung: 'Niederschlag über Deutschland' },
    });

    expect(container.querySelectorAll('.histogramm__balken')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Niederschlag über Deutschland' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('hebt nur die Klassen innerhalb der Bedingung hervor', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { anteile: [1, 1, 1, 1], beschriftung: 'Verteilung', von: 0.5, bis: 1 },
    });

    expect(container.querySelectorAll('.histogramm__balken--drin')).toHaveLength(2);
  });

  it('kommt ohne Klassen aus', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { anteile: [], beschriftung: 'Verteilung' },
    });

    expect(container.querySelectorAll('.histogramm__balken')).toHaveLength(0);
  });
});
