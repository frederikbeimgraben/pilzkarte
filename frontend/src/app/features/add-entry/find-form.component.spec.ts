import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { FIND } from '../../testing/entries-fixture';
import type { Find } from '../../core/api/models';
import { FindFormComponent, type FindSubmission } from './find-form.component';

interface Setup {
  container: Element;
  submissions: FindSubmission[];
  cancels: number;
  toasts: ToastSpy;
}

async function build(start: Find | null = null): Promise<Setup> {
  const { container, detectChanges, fixture } = await render(FindFormComponent, {
    inputs: {
      location: [9.0511, 48.5203] as readonly [number, number],
      titel: 'Fund melden',
      mainText: 'Speichern',
      start,
    },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(SPECIES_LIST);
  detectChanges();
  const submissions: FindSubmission[] = [];
  let cancels = 0;
  fixture.componentInstance.submitted.subscribe((submission) => submissions.push(submission));
  fixture.componentInstance.cancelled.subscribe(() => (cancels += 1));
  return {
    container,
    submissions,
    toasts: toastSpy(),
    get cancels() {
      return cancels;
    },
  };
}

describe('FundFormularComponent', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 10, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Ort, Vorgabe-Art und das heutige Datum', async () => {
    const { container } = await build();

    expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-10');
    expect(
      screen.getByText('Ohne Verbindung wird der Fund lokal gespeichert und später übertragen.'),
    ).toBeInTheDocument();
    await noViolations(container);
  });

  it('gibt Art, Datum, Anzahl, Notiz und Sichtbarkeit ab', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Anzahl'), '3');
    await userEvent.type(screen.getByLabelText('Notiz'), 'Unter Fichten');
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input).toEqual({
      artSlug: 'steinpilz',
      lat: 48.5203,
      lon: 9.0511,
      datum: '2026-09-10',
      anzahl: 3,
      notiz: 'Unter Fichten',
      sichtbarkeit: 'geteilt',
      fuerTraining: false,
    });
  });

  it('lässt Anzahl und Notiz weg, wenn nichts dasteht', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.anzahl).toBeNull();
    expect(setup.submissions[0].input.notiz).toBeNull();
  });

  it('wechselt die Art über die Auswahl aus dem Katalog', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await userEvent.click(screen.getByRole('button', { name: /Semmelstoppelpilz/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.artSlug).toBe('semmelstoppelpilz');
  });

  it('bricht die Artauswahl ab, ohne die Art zu wechseln', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.artSlug).toBe('steinpilz');
  });

  it('weist ein Datum in der Zukunft zurück', async () => {
    const setup = await build();

    await userEvent.clear(screen.getByLabelText('Datum'));
    await userEvent.type(screen.getByLabelText('Datum'), '2027-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Das Datum liegt in der Zukunft.']);
  });

  it('weist eine Anzahl unter eins zurück', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Anzahl'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Die Anzahl ist eine ganze Zahl ab 1.']);
  });

  it('gibt einen Fund erst auf Wunsch für das Training frei', async () => {
    const setup = await build();

    expect(
      screen.getByText(
        'Der genaue Fundort fließt in das Modell der nächsten Vorhersage ein. Unabhängig von der Sichtbarkeit.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Für das Training freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.fuerTraining).toBe(true);
  });

  it('meldet den Abbruch', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.cancels).toBe(1);
  });

  it('füllt sich aus einem vorhandenen Fund und lässt die Fotos weg', async () => {
    await render(FindFormComponent, {
      inputs: {
        location: [FIND.lon, FIND.lat] as readonly [number, number],
        titel: 'Bearbeiten',
        mainText: 'Speichern',
        start: FIND,
        withPhotos: false,
      },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(SPECIES_LIST);

    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-06');
    expect(screen.getByLabelText('Anzahl')).toHaveValue(3);
    expect(screen.queryByText('Fotos')).not.toBeInTheDocument();
    // `ngModel` schreibt den Anfangswert erst nach dem ersten Durchlauf.
    await vi.waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Für das Training freigeben' })).toBeChecked(),
    );
  });

  it('lässt die Anzahl leer, wenn der Fund keine trägt', async () => {
    await render(FindFormComponent, {
      inputs: {
        location: [FIND.lon, FIND.lat] as readonly [number, number],
        titel: 'Bearbeiten',
        mainText: 'Speichern',
        start: { ...FIND, anzahl: null },
      },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(SPECIES_LIST);

    expect(screen.getByLabelText('Anzahl')).toHaveValue(null);
  });

  it('meldet, wenn der Katalog keine Art zur Karte kennt', async () => {
    const { detectChanges, fixture } = await render(FindFormComponent, {
      inputs: {
        location: [9, 48] as readonly [number, number],
        titel: 'Fund melden',
        mainText: 'Speichern',
      },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/arten')
      .flush({ ...SPECIES_LIST, arten: [] });
    detectChanges();
    const submissions: FindSubmission[] = [];
    fixture.componentInstance.submitted.subscribe((submission) => submissions.push(submission));
    const toasts = toastSpy();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(submissions).toHaveLength(0);
    expect(toasts.failure).toEqual(['Wähle eine Art.']);
  });
});
