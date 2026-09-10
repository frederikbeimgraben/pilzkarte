import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { FIND } from '../../testing/entries-fixture';
import { PhotoGalleryComponent } from './photo-gallery.component';

describe('FotoGalerieComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:foto', revokeObjectURL: () => undefined });
  });

  it('holt jedes Foto über die eigene Route und zeigt es', async () => {
    const { container, detectChanges } = await render(PhotoGalleryComponent, {
      inputs: { findId: FIND.id, fotos: FIND.fotos },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/funde/${FIND.id}/fotos/foto-eins`)
      .flush(new Blob(['bild']));
    await vi.waitFor(() => {
      detectChanges();
      expect(screen.getByRole('img', { name: 'Foto 1' })).toBeInTheDocument();
    });

    await noViolations(container);
  });

  it('zeigt nichts, wenn ein Foto nicht kommt', async () => {
    const { detectChanges } = await render(PhotoGalleryComponent, {
      inputs: { findId: FIND.id, fotos: FIND.fotos },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/funde/${FIND.id}/fotos/foto-eins`)
      .error(new ProgressEvent('error'));
    await vi.waitFor(() => {
      detectChanges();
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('holt gar nichts, wenn ein Fund keine Fotos trägt', async () => {
    await render(PhotoGalleryComponent, {
      inputs: { findId: FIND.id, fotos: [] },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    TestBed.inject(HttpTestingController).verify();
  });
});
