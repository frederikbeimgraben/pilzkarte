import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Permission, SpeciesCatalogue } from '../../core/api/models';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { PENNY_BUN_BRIEF, SPECIES_LIST } from '../../testing/species-fixture';
import { toastSpy } from '../../testing/toast-spy';
import { SubmitImageComponent } from './submit-image.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

const IMAGE = new File(['x'], 'pilz.jpg', { type: 'image/jpeg' });

/**
 * Was das Gerät auf `watchPosition` antwortet: ein Punkt, eine abgelehnte
 * Freigabe, oder nichts — noch kein Signal.
 */
type Answer = readonly [number, number] | 'abgelehnt' | 'still';

function stubGeolocation(answer: Answer): void {
  const value: Partial<Geolocation> = {
    watchPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if (answer === 'abgelehnt') {
        failure?.({
          code: 1,
          PERMISSION_DENIED: 1,
          message: 'abgelehnt',
        } as GeolocationPositionError);
      } else if (answer !== 'still') {
        success({
          coords: { longitude: answer[0], latitude: answer[1], accuracy: 12 },
        } as GeolocationPosition);
      }
      return 1;
    },
    clearWatch: () => undefined,
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value });
}

async function build(held: Permission[] = [], catalogue: SpeciesCatalogue = SPECIES_LIST): Promise<Setup> {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:eins',
    revokeObjectURL: () => undefined,
  });
  const api = new AccessApiDouble();
  api.mineAnswer = held;
  const { container, detectChanges } = await render(SubmitImageComponent, {
    inputs: { slug: 'steinpilz' },
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(ANY_ROUTE),
      ...authStubProviders(new AuthStub()),
      accessApiProvider(api),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  // Der Katalog nennt Namen und Schutz; der Schutz entscheidet über den Ort.
  http.expectOne('/api/arten?alle=true').flush(catalogue);
  TestBed.inject(ApplicationRef).tick();
  detectChanges();
  return { container, http, router: TestBed.inject(Router), refresh: detectChanges };
}

async function pick(container: Element): Promise<void> {
  const field = container.querySelector<HTMLInputElement>('input[type=file]');
  if (field === null) throw new Error('Das Formular hat kein Feld für die Datei.');
  await userEvent.upload(field, IMAGE);
}

describe('SubmitImageComponent', () => {
  it('sagt nüchtern, dass das Bild geprüft wird', async () => {
    const { container } = await build();

    expect(screen.getByRole('heading', { level: 1, name: 'Bild einreichen' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Das Bild wird geprüft, bevor es andere sehen. Der Zustand steht unter Konto bei Meine Bilder.',
      ),
    ).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt ohne Bild und ohne Fotograf nichts abschicken', async () => {
    const { container, http } = await build();

    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeDisabled();
    await pick(container);

    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeDisabled();
    http.expectNone('/api/species-images/submissions');
  });

  it('reicht Bild, Fotograf und Lizenz zusammen ein', async () => {
    const { container, http, refresh } = await build();

    await pick(container);
    await userEvent.type(screen.getByLabelText('Foto'), 'Marie Weber');
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Zur Prüfung einreichen' }));

    const request = http.expectOne('/api/species-images/submissions');
    const body = request.request.body as FormData;
    expect(body.get('speciesSlug')).toBe('steinpilz');
    expect(body.get('photographer')).toBe('Marie Weber');
    expect(body.get('licence')).toBe('own');
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('fragt nach der Quelle, sobald die Lizenz nicht die eigene ist', async () => {
    const { refresh } = await build();

    expect(screen.queryByLabelText('Quelle')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Lizenz'), 'cc-by-4');
    refresh();

    expect(screen.getByLabelText('Quelle')).toBeInTheDocument();
  });

  it('stellt das Bild sofort an die Art, wer es hochladen darf', async () => {
    const { container, http, refresh } = await build(['image.upload']);

    expect(screen.getByRole('heading', { level: 1, name: 'Bild hinzufügen' })).toBeInTheDocument();
    expect(screen.getByText('Das Bild steht nach dem Speichern an der Art.')).toBeInTheDocument();
    await pick(container);
    await userEvent.type(screen.getByLabelText('Foto'), 'Marie Weber');
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    http.expectOne('/api/species-images');
  });

  it('führt nach dem Einreichen zurück zur Art', async () => {
    const { container, http, router, refresh } = await build();
    const toasts = toastSpy();

    await pick(container);
    await userEvent.type(screen.getByLabelText('Foto'), 'Marie Weber');
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Zur Prüfung einreichen' }));
    http.expectOne('/api/species-images/submissions').flush({});
    refresh();

    expect(toasts.success).toContain('Das Bild liegt zur Prüfung bereit.');
    await vi.waitFor(() => {
      expect(router.url).toBe('/arten/steinpilz');
    });
  });

  it('bietet den Ort an und nennt die Rundung', async () => {
    stubGeolocation([9.0511, 48.5203]);
    const { refresh } = await build();

    expect(screen.getByText(/Er wird auf 5 km gerundet gespeichert, nie genau\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Standort dieses Geräts übernehmen' }));
    await vi.waitFor(() => {
      refresh();
      expect(screen.getByText('48,52 · 9,05, auf 5 km gerundet')).toBeInTheDocument();
    });
  });

  it('schickt den genauen Punkt mit; gerundet wird im Dienst', async () => {
    stubGeolocation([9.0511, 48.5203]);
    const { container, http, refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Standort dieses Geräts übernehmen' }));
    await vi.waitFor(() => {
      refresh();
      expect(screen.getByRole('button', { name: 'Ort entfernen' })).toBeInTheDocument();
    });
    await pick(container);
    await userEvent.type(screen.getByLabelText('Foto'), 'Marie Weber');
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Zur Prüfung einreichen' }));

    const body = http.expectOne('/api/species-images/submissions').request.body as FormData;
    expect(body.get('lat')).toBe('48.5203');
    expect(body.get('lon')).toBe('9.0511');
  });

  it('nimmt den Ort wieder weg', async () => {
    stubGeolocation([9.0511, 48.5203]);
    const { refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Standort dieses Geräts übernehmen' }));
    await vi.waitFor(() => {
      refresh();
      expect(screen.getByRole('button', { name: 'Ort entfernen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Ort entfernen' }));
    refresh();

    expect(screen.getByRole('button', { name: 'Standort dieses Geräts übernehmen' })).toBeInTheDocument();
  });

  it('sagt Bescheid, solange kein Standort da ist', async () => {
    stubGeolocation('still');
    await build();
    const toasts = toastSpy();

    await userEvent.click(screen.getByRole('button', { name: 'Standort dieses Geräts übernehmen' }));

    expect(toasts.failure).toContain('Kein Standort. Ohne Freigabe oder ohne Signal bleibt das Feld leer.');
  });

  it('bietet den Ort nicht an, wenn die Freigabe abgelehnt ist', async () => {
    stubGeolocation('abgelehnt');
    const { refresh } = await build();
    refresh();

    expect(
      screen.queryByRole('button', { name: 'Standort dieses Geräts übernehmen' }),
    ).not.toBeInTheDocument();
  });

  it('bietet einer streng geschützten Art gar keinen Ort an', async () => {
    stubGeolocation([9.0511, 48.5203]);
    const strict = {
      ...PENNY_BUN_BRIEF,
      schutz: { status: 'strengGeschuetzt', quelle: 'BArtSchV' },
    } as const;
    await build([], { ...SPECIES_LIST, arten: [strict, ...SPECIES_LIST.arten.slice(1)] });

    expect(
      screen.queryByRole('button', { name: 'Standort dieses Geräts übernehmen' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Ort')).not.toBeInTheDocument();
  });
});
