import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { imageSubmission } from '../../testing/species-images-fixture';
import type { ImageSubmission } from '../../core/api/models';
import { MyImagesComponent } from './my-images.component';

async function build(
  entries: ImageSubmission[],
  total?: number,
): Promise<{ container: Element; http: HttpTestingController; refresh: () => void }> {
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
    .expectOne('/api/species-images/mine?offset=0&limit=25')
    .flush({ eintraege: entries, gesamt: total ?? entries.length, limit: 25, offset: 0 });
  detectChanges();
  for (const request of http.match((request) => request.url.endsWith('/thumb'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  detectChanges();
  return { container, http, refresh: detectChanges };
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

  it('holt die nächste Seite ans Ende und zählt mit', async () => {
    const first = ['eins', 'zwei'].map((id) => imageSubmission({ id, state: 'approved' }));
    const { http, refresh } = await build(first, 3);

    expect(screen.getByText('2 von 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mehr laden' }));
    // Der Versatz folgt dem, was schon geladen ist, nicht der Seitenzahl.
    http.expectOne('/api/species-images/mine?offset=2&limit=25').flush({
      eintraege: [imageSubmission({ id: 'drei', state: 'rejected', rejectReason: 'Unscharf.' })],
      gesamt: 3,
      limit: 25,
      offset: 2,
    });
    refresh();
    for (const request of http.match((call) => call.url.endsWith('/thumb'))) {
      request.flush(new Blob(['x'], { type: 'image/jpeg' }));
    }
    refresh();

    expect(screen.getByText('Unscharf.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument();
  });
});
