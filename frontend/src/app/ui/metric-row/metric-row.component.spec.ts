import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { MetricRowComponent } from './metric-row.component';

describe('MetricRowComponent', () => {
  it('nennt zur Zahl ihren Bezug', async () => {
    const { container } = await render(MetricRowComponent, {
      inputs: {
        label: 'Vorhersage Steinpilz, KW 40',
        subline: 'Flächenmittel, je Begehung',
        value: '18 %',
      },
    });

    expect(screen.getByText('Vorhersage Steinpilz, KW 40')).toBeInTheDocument();
    expect(screen.getByText('Flächenmittel, je Begehung')).toBeInTheDocument();
    expect(screen.getByText('18 %')).toBeInTheDocument();
    await noViolations(container);
  });

  it('kommt ohne Unterzeile aus', async () => {
    const { container } = await render(MetricRowComponent, {
      inputs: { label: 'Eigene Funde in der Zone', value: '2' },
    });

    expect(container.querySelector('.metric__sub')).toBeNull();
  });
});
