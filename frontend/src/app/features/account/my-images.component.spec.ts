import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { imageSubmission } from '../../testing/species-images-fixture';
import type { ImageSubmission } from '../../core/api/models';
import { MyImagesComponent } from './my-images.component';

async function build(entries: ImageSubmission[]): Promise<{ container: Element }> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(MyImagesComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/arten?alle=true').flush(SPECIES_LIST);
  http
    .expectOne('/api/species-images/mine')
    .flush({ eintraege: entries, gesamt: entries.length, limit: 50, offset: 0 });
  detectChanges();
  for (const request of http.match((request) => request.url.endsWith('/thumb'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  detectChanges();
  return { container };
}

describe('MyImagesComponent', () => {
  it('zeigt je Einreichung den Zustand', async () => {
    const { container } = await build([
      imageSubmission({ id: 'bild-eins', speciesSlug: 'steinpilz', state: 'approved' }),
      imageSubmission({ id: 'bild-zwei', speciesSlug: 'pfifferling', state: 'submitted' }),
    ]);

    expect(screen.getByText('Freigegeben')).toBeInTheDocument();
    expect(screen.getByText('In Prüfung')).toBeInTheDocument();
    expect(screen.getAllByText('Eingereicht am 9. September 2026')).toHaveLength(2);
    await noViolations(container);
  });

  it('nennt bei einer Absage den Grund', async () => {
    await build([
      imageSubmission({
        id: 'bild-drei',
        state: 'rejected',
        rejectReason: 'Unscharf, die Röhren sind nicht zu erkennen.',
      }),
    ]);

    expect(screen.getByText('Abgelehnt')).toBeInTheDocument();
    expect(screen.getByText('Unscharf, die Röhren sind nicht zu erkennen.')).toBeInTheDocument();
  });

  it('zeigt ohne Einreichung den Leerzustand', async () => {
    await build([]);

    expect(screen.getByText('Du hast noch kein Bild eingereicht.')).toBeInTheDocument();
  });
});
