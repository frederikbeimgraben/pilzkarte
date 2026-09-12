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
import { AdminImagesComponent } from './images.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  refresh: () => void;
}

const OPEN: ImageSubmission = imageSubmission({
  id: 'bild-eins',
  speciesSlug: 'steinpilz',
  submittedBy: 'Jonas Weber',
  licence: 'cc-by-4',
});

async function build(entries: ImageSubmission[] = [OPEN]): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const { container, detectChanges } = await render(AdminImagesComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/arten?alle=true').flush(SPECIES_LIST);
  http
    .expectOne('/api/species-images/submissions?state=submitted')
    .flush({ eintraege: entries, gesamt: entries.length, limit: 50, offset: 0 });
  detectChanges();
  return { container, http, refresh: detectChanges };
}

/** Die Vorschau geht ihren eigenen Weg; ohne Antwort bleibt die Anfrage offen. */
function answerThumbs(http: HttpTestingController): void {
  for (const request of http.match((request) => request.url.endsWith('/thumb'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
}

describe('AdminImagesComponent', () => {
  it('stellt den Eingang als Aufgabenliste mit beiden Knöpfen auf', async () => {
    const { container, http } = await build();
    answerThumbs(http);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Jonas Weber · CC BY 4.0 · 9. September 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Freigeben' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ablehnen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('nennt kein Prüfdatum an einer offenen Einreichung', async () => {
    const { http } = await build();
    answerThumbs(http);

    expect(screen.queryByText(/geprüft/i)).not.toBeInTheDocument();
  });

  it('gibt ein Bild frei und lädt den Eingang neu', async () => {
    const { http, refresh } = await build();
    answerThumbs(http);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    const approval = http.expectOne('/api/species-images/bild-eins/approval');
    expect(approval.request.method).toBe('POST');
    approval.flush({ ...OPEN, state: 'approved' });
    http
      .expectOne('/api/species-images/submissions?state=submitted')
      .flush({ eintraege: [], gesamt: 0, limit: 50, offset: 0 });
    refresh();

    expect(screen.getByText('Hier liegt nichts zur Prüfung.')).toBeInTheDocument();
  });

  it('fragt beim Ablehnen erst in einem eigenen Blatt nach dem Grund', async () => {
    const { http, refresh } = await build();
    answerThumbs(http);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();

    expect(screen.getByRole('dialog', { name: 'Warum lehnst du ab?' })).toBeInTheDocument();
    http.expectNone('/api/species-images/bild-eins/rejection');
  });

  it('schickt den Grund mit der Absage', async () => {
    const { http, refresh } = await build();
    answerThumbs(http);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Unscharf' }));
    refresh();
    const buttons = screen.getAllByRole('button', { name: 'Ablehnen' });
    // Der letzte Knopf steht im Blatt, der erste in der Zeile darunter.
    await userEvent.click(buttons[buttons.length - 1]);

    const rejection = http.expectOne('/api/species-images/bild-eins/rejection');
    expect(rejection.request.body).toEqual({ reason: 'Unscharf' });
  });

  it('wechselt die Sicht auf die abgelehnten und zeigt ihren Grund', async () => {
    const { http, refresh } = await build();
    answerThumbs(http);

    await userEvent.click(screen.getByRole('tab', { name: 'Abgelehnt' }));
    http.expectOne('/api/species-images/submissions?state=rejected').flush({
      eintraege: [{ ...OPEN, state: 'rejected', rejectReason: 'Unscharf, die Röhren fehlen.' }],
      gesamt: 1,
      limit: 50,
      offset: 0,
    });
    refresh();
    answerThumbs(http);

    expect(screen.getByText('Unscharf, die Röhren fehlen.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Freigeben' })).not.toBeInTheDocument();
  });
});
