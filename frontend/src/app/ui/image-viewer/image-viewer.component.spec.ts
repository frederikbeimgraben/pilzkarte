import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { speciesImage } from '../../testing/species-images-fixture';
import { ImageViewerComponent } from './image-viewer.component';

describe('ImageViewerComponent', () => {
  it('bleibt ohne Bild zu', async () => {
    await render(ImageViewerComponent, { inputs: { image: null, titel: 'Steinpilz' } });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('zeigt das Bild groß mit Fotograf, Lizenz und Aufnahmetag', async () => {
    const { container } = await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ caption: 'Junges Exemplar' }), titel: 'Steinpilz' },
    });

    const image = screen.getByRole('img', { name: 'Junges Exemplar' });
    expect(image).toHaveAttribute('src', '/api/species-images/bild-eins/full');
    expect(screen.getByText('Marie Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026')).toBeInTheDocument();
    expect(screen.getByText('Junges Exemplar')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt weg, was das Bild nicht hat', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ takenOn: null, source: null }), titel: 'Steinpilz' },
    });

    expect(screen.queryByText('Aufgenommen')).not.toBeInTheDocument();
    expect(screen.queryByText('Quelle')).not.toBeInTheDocument();
  });

  it('nennt die Quelle, wenn eine dabei ist', async () => {
    await render(ImageViewerComponent, {
      inputs: { image: speciesImage({ source: 'https://example.test/pilz' }), titel: 'Steinpilz' },
    });

    expect(screen.getByText('https://example.test/pilz')).toBeInTheDocument();
  });

  it('nimmt den Namen der Art als Bildbeschreibung, wenn keine Unterschrift dasteht', async () => {
    await render(ImageViewerComponent, { inputs: { image: speciesImage(), titel: 'Steinpilz' } });

    expect(screen.getByRole('img', { name: 'Aufnahme von Steinpilz' })).toBeInTheDocument();
  });

  it('meldet das Schließen nach draußen', async () => {
    const { fixture } = await render(ImageViewerComponent, {
      inputs: { image: speciesImage(), titel: 'Steinpilz' },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Bild schließen' }));

    expect(calls).toBe(1);
  });
});
