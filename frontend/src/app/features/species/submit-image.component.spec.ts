import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Permission } from '../../core/api/models';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { toastSpy } from '../../testing/toast-spy';
import { SubmitImageComponent } from './submit-image.component';

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
  refresh: () => void;
}

const IMAGE = new File(['x'], 'pilz.jpg', { type: 'image/jpeg' });

async function build(held: Permission[] = []): Promise<Setup> {
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
  http.expectOne('/api/arten?alle=true').flush(SPECIES_LIST);
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
});
