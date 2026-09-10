import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { CrosshairComponent } from './crosshair.component';

describe('CrosshairComponent', () => {
  it('nennt sich als Bild mit Beschriftung', async () => {
    const { container } = await render(CrosshairComponent, { inputs: { label: 'Fundort' } });

    expect(screen.getByRole('img', { name: 'Fundort' })).toBeInTheDocument();
    await noViolations(container);
  });
});
