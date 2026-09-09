import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { SvgIconComponent } from './svg-icon.component';

describe('SvgIconComponent', () => {
  it('zeichnet ein beschriftetes Piktogramm als Bild', async () => {
    const { container } = await render(SvgIconComponent, {
      inputs: { name: 'karte', beschriftung: 'Karte' },
    });

    expect(screen.getByRole('img', { name: 'Karte' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('versteckt ein Piktogramm ohne Beschriftung vor Hilfsmitteln', async () => {
    const { container } = await render(SvgIconComponent, { inputs: { name: 'plus' } });

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('nimmt für die gefüllten Pfeile das kleinere Raster', async () => {
    const { container } = await render(SvgIconComponent, { inputs: { name: 'rechts' } });

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 12 12');
  });
});
