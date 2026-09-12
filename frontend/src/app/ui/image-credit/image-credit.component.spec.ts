import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ImageCreditComponent } from './image-credit.component';

describe('ImageCreditComponent', () => {
  it('nennt Fotograf und Lizenz in einer Zeile', async () => {
    const { container } = await render(ImageCreditComponent, {
      inputs: { photographer: 'Marie Weber', licence: 'cc-by-sa-4' },
    });

    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt ein eigenes Foto als solches aus', async () => {
    await render(ImageCreditComponent, {
      inputs: { photographer: 'Frederik Beimgraben', licence: 'own' },
    });

    expect(screen.getByText('Foto: Frederik Beimgraben · Eigenes Foto')).toBeInTheDocument();
  });
});
