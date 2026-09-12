import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesImage } from '../../testing/species-images-fixture';
import { SpeciesImagesComponent } from './species-images.component';

const LEAD = speciesImage({ id: 'bild-eins', lead: true });
const SECOND = speciesImage({ id: 'bild-zwei', lead: false, caption: 'Im Moos' });

/** Der Weg zum Einreichen steht nur einer angemeldeten Person offen. */
function providers(signedIn: boolean) {
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  return [provideRouter(ANY_ROUTE), ...authStubProviders(auth)];
}

describe('SpeciesImagesComponent', () => {
  it('zeigt einen einheitlichen Leerzustand und keinen leeren Rahmen', async () => {
    const { container } = await render(SpeciesImagesComponent, {
      inputs: { images: [], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
    });

    expect(screen.getByText('Zu dieser Art gibt es noch kein Bild.')).toBeInTheDocument();
    expect(container.querySelector('.gallery__lead')).toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt das Titelbild nach oben und die weiteren in den Streifen', async () => {
    const { container } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD, SECOND], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
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
      inputs: { images: [LEAD], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
    });

    expect(container.querySelector('.gallery__strip')).toBeNull();
  });

  it('nennt Fotograf und Lizenz am Bild', async () => {
    await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
    });

    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
  });

  it('öffnet das Titelbild groß, mit Fotograf und Lizenz', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD, SECOND], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Aufnahme von Steinpilz groß ansehen' }));
    detectChanges();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Marie Weber')).toBeInTheDocument();
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
  });

  it('öffnet auch ein Bild aus dem Streifen', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD, SECOND], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Im Moos groß ansehen' }));
    detectChanges();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('schließt die Großansicht wieder', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(false),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Aufnahme von Steinpilz groß ansehen' }));
    detectChanges();

    await userEvent.click(screen.getByRole('button', { name: 'Bild schließen' }));
    detectChanges();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('führt eine angemeldete Person aus dem Streifen zum Einreichen', async () => {
    const { detectChanges } = await render(SpeciesImagesComponent, {
      inputs: { images: [LEAD], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(true),
    });
    detectChanges();

    await userEvent.click(screen.getByRole('button', { name: 'Bild einreichen' }));

    expect(TestBed.inject(Router).url).toBe('/arten/steinpilz/bild');
  });

  it('bietet den Weg zum Einreichen auch im Leerzustand an', async () => {
    await render(SpeciesImagesComponent, {
      inputs: { images: [], speciesName: 'Steinpilz', slug: 'steinpilz' },
      providers: providers(true),
    });

    expect(screen.getByRole('button', { name: 'Bild einreichen' })).toBeInTheDocument();
  });
});
