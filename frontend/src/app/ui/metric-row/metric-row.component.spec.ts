import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { MetricRowComponent } from './metric-row.component';

describe('MetricRowComponent', () => {
  it('nennt zur Zahl ihren Bezug', async () => {
    const { container } = await render(MetricRowComponent, {
      inputs: {
        beschriftung: 'Vorhersage Steinpilz, KW 40',
        unter: 'Flächenmittel, je Begehung',
        wert: '18 %',
      },
    });

    expect(screen.getByText('Vorhersage Steinpilz, KW 40')).toBeInTheDocument();
    expect(screen.getByText('Flächenmittel, je Begehung')).toBeInTheDocument();
    expect(screen.getByText('18 %')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('kommt ohne Unterzeile aus', async () => {
    const { container } = await render(MetricRowComponent, {
      inputs: { beschriftung: 'Eigene Funde in der Zone', wert: '2' },
    });

    expect(container.querySelector('.metrik__unter')).toBeNull();
  });
});
