import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { CrosshairComponent } from './crosshair.component';

describe('CrosshairComponent', () => {
  it('nennt sich als Bild mit Beschriftung', async () => {
    const { container } = await render(CrosshairComponent, { inputs: { beschriftung: 'Fundort' } });

    expect(screen.getByRole('img', { name: 'Fundort' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });
});
