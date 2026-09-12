import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { RampComponent } from './ramp.component';
import { FORECAST_RAMP } from './ramp-colors';

describe('RampComponent', () => {
  it('zeigt Beschriftung, beide Enden und jede Stufe', async () => {
    const { container } = await render(RampComponent, {
      inputs: { label: 'Fundwahrscheinlichkeit je Begehung', von: '0 %', bis: '50 %' },
    });

    expect(screen.getByText('Fundwahrscheinlichkeit je Begehung')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(container.querySelectorAll('.ramp__step')).toHaveLength(FORECAST_RAMP.length);
    await noViolations(container);
  });

  it('trägt die Fußnote nur, wenn eine da ist', async () => {
    const { fixture, container } = await render(RampComponent, {
      inputs: { label: 'Waldanteil', von: '0 %', bis: '100 %' },
    });

    expect(container.querySelector('app-note')).toBeNull();

    fixture.componentRef.setInput('note', 'Eine Zelle misst 500 Meter.');
    fixture.detectChanges();

    expect(screen.getByText('Eine Zelle misst 500 Meter.')).toBeInTheDocument();
  });

  it('nennt Hilfsmitteln die Spanne des Verlaufs', async () => {
    await render(RampComponent, {
      inputs: { label: 'Niederschlag', von: '0 mm', bis: '152 mm', colors: ['#000', '#fff'] },
    });

    expect(screen.getByRole('img', { name: 'Niederschlag: 0 mm – 152 mm' })).toBeInTheDocument();
  });
});
