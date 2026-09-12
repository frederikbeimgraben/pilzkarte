import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { TextCatalogue, TextEntry } from '../../core/api/models';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { TextsComponent } from './texts.component';

const LEGEND: TextEntry = {
  key: 'karte.legende',
  values: { de: 'Fundwahrscheinlichkeit je Begehung', en: 'Probability of a find per visit' },
  changed: false,
  updatedAt: '2026-09-12T08:00:00+00:00',
};

const CHIP: TextEntry = {
  key: 'arten.chip.mitVorhersage',
  values: { de: 'Mit Vorhersage', en: 'With forecast' },
  changed: true,
  updatedAt: '2026-09-12T09:00:00+00:00',
};

const CATALOGUE: TextCatalogue = {
  revision: 'W/"4-1"',
  locales: ['de', 'en'],
  entries: [LEGEND, CHIP],
};

interface Setup {
  container: Element;
  http: HttpTestingController;
  toasts: ToastSpy;
}

async function build(): Promise<Setup> {
  localStorage.clear();
  const { container } = await render(TextsComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/texts').flush(CATALOGUE);
  return { container, http, toasts: toastSpy() };
}

describe('TextsComponent', () => {
  it('zeigt jeden Schlüssel mit beiden Sprachen', async () => {
    const setup = await build();

    expect(await screen.findByText('karte.legende')).toBeInTheDocument();
    expect(screen.getByText('Fundwahrscheinlichkeit je Begehung')).toBeInTheDocument();
    expect(screen.getByText('Probability of a find per visit')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('markiert einen geänderten Text', async () => {
    await build();

    expect(await screen.findByText('geändert')).toBeInTheDocument();
  });

  it('sucht in Schlüssel und Text', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.type(screen.getByLabelText('Schlüssel oder Text suchen'), 'forecast');

    expect(screen.queryByText('karte.legende')).not.toBeInTheDocument();
    expect(screen.getByText('arten.chip.mitVorhersage')).toBeInTheDocument();
  });

  it('filtert nach Bereich', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByRole('button', { name: 'Karte' }));

    expect(screen.getByText('karte.legende')).toBeInTheDocument();
    expect(screen.queryByText('arten.chip.mitVorhersage')).not.toBeInTheDocument();
  });

  it('zeigt nur die geänderten Einträge', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByRole('button', { name: 'Geändert' }));

    expect(screen.queryByText('karte.legende')).not.toBeInTheDocument();
    expect(screen.getByText('arten.chip.mitVorhersage')).toBeInTheDocument();
  });

  it('speichert eine Änderung und schließt das Blatt', async () => {
    const setup = await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByText('karte.legende'));
    const field = await screen.findByLabelText('Deutsch');
    await userEvent.clear(field);
    await userEvent.type(field, 'Trefferquote');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    const request = await vi.waitFor(() => setup.http.expectOne('/api/texts/karte.legende'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ locale: 'de', value: 'Trefferquote' });
    request.flush({ ...LEGEND, values: { ...LEGEND.values, de: 'Trefferquote' }, changed: true });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Text ist gespeichert.']);
    });
    expect(screen.getByText('Trefferquote')).toBeInTheDocument();
  });

  it('bietet das Zurücksetzen nur bei einem geänderten Text an', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByText('karte.legende'));
    await screen.findByRole('button', { name: 'Speichern' });
    expect(screen.queryByRole('button', { name: 'Auf Vorgabe zurücksetzen' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await userEvent.click(screen.getByText('arten.chip.mitVorhersage'));

    expect(await screen.findByRole('button', { name: 'Auf Vorgabe zurücksetzen' })).toBeInTheDocument();
  });

  it('holt die Vorgabe in beiden Sprachen zurück', async () => {
    const setup = await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByText('arten.chip.mitVorhersage'));
    await userEvent.click(await screen.findByRole('button', { name: 'Auf Vorgabe zurücksetzen' }));

    for (const locale of ['de', 'en']) {
      const request = await vi.waitFor(() =>
        setup.http.expectOne(`/api/texts/arten.chip.mitVorhersage?locale=${locale}`),
      );
      expect(request.request.method).toBe('DELETE');
      request.flush({ ...CHIP, changed: false });
    }

    await vi.waitFor(() => {
      expect(setup.toasts.success).toHaveLength(1);
    });
  });

  it('sagt, wenn nichts zur Suche passt', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.type(screen.getByLabelText('Schlüssel oder Text suchen'), 'zzz');

    expect(screen.getByText('Kein Schlüssel passt zur Suche.')).toBeInTheDocument();
  });
});
