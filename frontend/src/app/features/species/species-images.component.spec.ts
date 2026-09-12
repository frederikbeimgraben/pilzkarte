import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { speciesImage } from '../../testing/species-images-fixture';
import { SpeciesImagesComponent } from './species-images.component';

const LEAD = speciesImage({ id: 'bild-eins', lead: true });
const SECOND = speciesImage({ id: 'bild-zwei', lead: false, caption: 'Im Moos' });

describe('SpeciesImagesComponent', () => {
  it('zeigt einen einheitlichen Leerzustand und keinen leeren Rahmen', async () => {
    const { container } = await render(SpeciesImagesComponent, {
      inputs: { images: [], speciesName: 'Steinpilz' },
    });

    expect(screen.getByText('Zu dieser Art gibt es noch kein Bild.')).toBeInTheDocument();
    expect(container.querySelector('.gallery__lead')).toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt das Titelbild nach oben und die weiteren in den Streifen', async () => {
    const { container } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD, SECOND], speciesName: 'Steinpilz' },
    });

    const lead = container.querySelector('.gallery__lead img');
    expect(lead).toHaveAttribute('src', '/api/species-images/bild-eins/full');
    const strip = container.querySelectorAll('.gallery__thumb img');
    expect([...strip].map((image) => image.getAttribute('src'))).toEqual([
      '/api/species-images/bild-zwei/thumb',
    ]);
    await noViolations(container);
  });

  it('lässt den Streifen weg, solange es nur ein Bild gibt', async () => {
    const { container } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD], speciesName: 'Steinpilz' },
    });

    expect(container.querySelector('.gallery__strip')).toBeNull();
  });

  it('nennt Fotograf und Lizenz am Bild', async () => {
    await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD], speciesName: 'Steinpilz' },
    });

    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
  });

  it('öffnet das Titelbild groß, mit Fotograf und Lizenz', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD, SECOND], speciesName: 'Steinpilz' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Aufnahme von Steinpilz groß ansehen' }));
    detectChanges();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Marie Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
  });

  it('öffnet auch ein Bild aus dem Streifen', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD, SECOND], speciesName: 'Steinpilz' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Im Moos groß ansehen' }));
    detectChanges();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('schließt die Großansicht wieder', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD], speciesName: 'Steinpilz' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Aufnahme von Steinpilz groß ansehen' }));
    detectChanges();

    await userEvent.click(screen.getByRole('button', { name: 'Bild schließen' }));
    detectChanges();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
