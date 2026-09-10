import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { keineVerstoesse } from '../../testing/axe';
import { toastSpion, type ToastSpion } from '../../testing/toast-spion';
import { FUND } from '../../testing/eintraege-fixture';
import type { Fund } from '../../core/api/models';
import { FundFormularComponent, type FundAbgabe } from './fund-formular.component';

interface Aufbau {
  container: Element;
  abgaben: FundAbgabe[];
  abbrueche: number;
  toasts: ToastSpion;
}

async function aufbauen(start: Fund | null = null): Promise<Aufbau> {
  const { container, detectChanges, fixture } = await render(FundFormularComponent, {
    inputs: {
      ort: [9.0511, 48.5203] as readonly [number, number],
      titel: 'Fund melden',
      hauptText: 'Speichern',
      start,
    },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(ARTEN_LISTE);
  detectChanges();
  const abgaben: FundAbgabe[] = [];
  let abbrueche = 0;
  fixture.componentInstance.absenden.subscribe((abgabe) => abgaben.push(abgabe));
  fixture.componentInstance.abbruch.subscribe(() => (abbrueche += 1));
  return {
    container,
    abgaben,
    toasts: toastSpion(),
    get abbrueche() {
      return abbrueche;
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
    const { container } = await aufbauen();

    expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-10');
    expect(
      screen.getByText('Ohne Verbindung wird der Fund lokal gespeichert und später übertragen.'),
    ).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('gibt Art, Datum, Anzahl, Notiz und Sichtbarkeit ab', async () => {
    const aufbau = await aufbauen();

    await userEvent.type(screen.getByLabelText('Anzahl'), '3');
    await userEvent.type(screen.getByLabelText('Notiz'), 'Unter Fichten');
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben[0].eingabe).toEqual({
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
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben[0].eingabe.anzahl).toBeNull();
    expect(aufbau.abgaben[0].eingabe.notiz).toBeNull();
  });

  it('wechselt die Art über die Auswahl aus dem Katalog', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await userEvent.click(screen.getByRole('button', { name: /Semmelstoppelpilz/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben[0].eingabe.artSlug).toBe('semmelstoppelpilz');
  });

  it('bricht die Artauswahl ab, ohne die Art zu wechseln', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben[0].eingabe.artSlug).toBe('steinpilz');
  });

  it('weist ein Datum in der Zukunft zurück', async () => {
    const aufbau = await aufbauen();

    await userEvent.clear(screen.getByLabelText('Datum'));
    await userEvent.type(screen.getByLabelText('Datum'), '2027-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben).toHaveLength(0);
    expect(aufbau.toasts.fehler).toEqual(['Das Datum liegt in der Zukunft.']);
  });

  it('weist eine Anzahl unter eins zurück', async () => {
    const aufbau = await aufbauen();

    await userEvent.type(screen.getByLabelText('Anzahl'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben).toHaveLength(0);
    expect(aufbau.toasts.fehler).toEqual(['Die Anzahl ist eine ganze Zahl ab 1.']);
  });

  it('gibt einen Fund erst auf Wunsch für das Training frei', async () => {
    const aufbau = await aufbauen();

    expect(
      screen.getByText(
        'Der genaue Fundort fließt in das Modell der nächsten Vorhersage ein. Unabhängig von der Sichtbarkeit.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Für das Training freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(aufbau.abgaben[0].eingabe.fuerTraining).toBe(true);
  });

  it('meldet den Abbruch', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(aufbau.abbrueche).toBe(1);
  });

  it('füllt sich aus einem vorhandenen Fund und lässt die Fotos weg', async () => {
    await render(FundFormularComponent, {
      inputs: {
        ort: [FUND.lon, FUND.lat] as readonly [number, number],
        titel: 'Bearbeiten',
        hauptText: 'Speichern',
        start: FUND,
        mitFotos: false,
      },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(ARTEN_LISTE);

    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-06');
    expect(screen.getByLabelText('Anzahl')).toHaveValue(3);
    expect(screen.queryByText('Fotos')).not.toBeInTheDocument();
    // `ngModel` schreibt den Anfangswert erst nach dem ersten Durchlauf.
    await vi.waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Für das Training freigeben' })).toBeChecked(),
    );
  });

  it('lässt die Anzahl leer, wenn der Fund keine trägt', async () => {
    await render(FundFormularComponent, {
      inputs: {
        ort: [FUND.lon, FUND.lat] as readonly [number, number],
        titel: 'Bearbeiten',
        hauptText: 'Speichern',
        start: { ...FUND, anzahl: null },
      },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(ARTEN_LISTE);

    expect(screen.getByLabelText('Anzahl')).toHaveValue(null);
  });

  it('meldet, wenn der Katalog keine Art zur Karte kennt', async () => {
    const { detectChanges, fixture } = await render(FundFormularComponent, {
      inputs: {
        ort: [9, 48] as readonly [number, number],
        titel: 'Fund melden',
        hauptText: 'Speichern',
      },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/arten')
      .flush({ ...ARTEN_LISTE, arten: [] });
    detectChanges();
    const abgaben: FundAbgabe[] = [];
    fixture.componentInstance.absenden.subscribe((abgabe) => abgaben.push(abgabe));
    const toasts = toastSpion();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(abgaben).toHaveLength(0);
    expect(toasts.fehler).toEqual(['Wähle eine Art.']);
  });
});
