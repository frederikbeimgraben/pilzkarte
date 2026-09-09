import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { RampComponent, VORHERSAGE_RAMPE } from './ramp.component';

describe('RampComponent', () => {
  it('zeigt Beschriftung, beide Enden und jede Stufe', async () => {
    const { container } = await render(RampComponent, {
      inputs: { beschriftung: 'Fundwahrscheinlichkeit je Begehung', von: '0 %', bis: '50 %' },
    });

    expect(screen.getByText('Fundwahrscheinlichkeit je Begehung')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(container.querySelectorAll('.rampe__stufe')).toHaveLength(VORHERSAGE_RAMPE.length);
    await keineVerstoesse(container);
  });

  it('nennt Hilfsmitteln die Spanne des Verlaufs', async () => {
    await render(RampComponent, {
      inputs: { beschriftung: 'Niederschlag', von: '0 mm', bis: '152 mm', farben: ['#000', '#fff'] },
    });

    expect(screen.getByRole('img', { name: 'Niederschlag: 0 mm – 152 mm' })).toBeInTheDocument();
  });
});
