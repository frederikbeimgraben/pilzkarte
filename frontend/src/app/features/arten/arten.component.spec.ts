import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ALLE_LISTE, ARTEN_LISTE, VERWECHSLUNG_LISTE } from '../../testing/arten-fixture';
import { keineVerstoesse } from '../../testing/axe';
import { ArtenComponent } from './arten.component';
import { ArtenZustand } from './arten.zustand';

interface Aufbau {
  container: Element;
  router: Router;
  zustand: ArtenZustand;
  aktualisiere: () => void;
  nachlade: (pfad: string, liste: typeof ARTEN_LISTE) => void;
}

async function aufbauen(): Promise<Aufbau> {
  const { container, detectChanges } = await render(ArtenComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(ARTEN_LISTE);
  detectChanges();
  const http = TestBed.inject(HttpTestingController);
  /** Der zweite Topf kommt erst, wenn Chip oder Suche ihn brauchen. */
  const nachlade = (pfad: string, liste: typeof ARTEN_LISTE): void => {
    http.expectOne(pfad).flush(liste);
    detectChanges();
  };
  return {
    container,
    router: TestBed.inject(Router),
    zustand: TestBed.inject(ArtenZustand),
    aktualisiere: detectChanges,
    nachlade,
  };
}

/**
 * Die Namen der sichtbaren Zeilen. Nicht jede Zeile trägt eine Kurve: eine Art,
 * die niemand sammelt, hat keine Saison.
 */
function namen(): string[] {
  return [...document.querySelectorAll('.artzeile__name')].map((zelle) => zelle.textContent.trim());
}

describe('ArtenComponent', () => {
  it('zeigt jede Art mit lateinischem Namen, Kurve und Tags', async () => {
    const { container } = await aufbauen();

    const zeile = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(zeile).getByText('Boletus edulis')).toBeInTheDocument();
    expect(within(zeile).getByText('Vorhersage')).toBeInTheDocument();
    expect(within(zeile).getByText('Geschützt')).toBeInTheDocument();
    expect(within(zeile).getByRole('img', { name: /Saisonkurve Steinpilz/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Speisemorchel/ })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('zeichnet in jeder Zeile beide Reihen der Saisonkurve', async () => {
    const { container } = await aufbauen();

    // Die kleine Kurve zeigt dieselben zwei Reihen wie die Artseite: die Fläche
    // aller Jahre und das laufende Jahr, das mit einem Punkt endet.
    expect(container.querySelectorAll('.funke__alle')).toHaveLength(4);
    expect(container.querySelectorAll('.funke__ende')).toHaveLength(4);
  });

  it('stellt die Arten nach Stufe und darin nach Namen auf', async () => {
    await aufbauen();

    // Vorhersage vor Saison vor Profil; die 23 Arten mit eigener Karte stehen
    // damit oben statt zwischen den Profilen verstreut.
    expect(namen()).toEqual(['Maronenröhrling', 'Steinpilz', 'Semmelstoppelpilz', 'Speisemorchel']);
  });

  it('lässt die aktive Art an ihrem Platz', async () => {
    const { zustand, aktualisiere } = await aufbauen();

    zustand.waehle('speisemorchel');
    aktualisiere();

    expect(namen().at(-1)).toBe('Speisemorchel');
  });

  it('sucht in Namen und lateinischen Namen', async () => {
    const { aktualisiere, nachlade } = await aufbauen();
    const feld = screen.getByLabelText('Art suchen');

    await userEvent.type(feld, 'morch');
    nachlade('/api/arten?alle=true', ALLE_LISTE);
    aktualisiere();
    expect(namen()).toEqual(['Speisemorchel']);

    await userEvent.clear(feld);
    await userEvent.type(feld, 'Imleria');
    aktualisiere();
    expect(namen()).toEqual(['Maronenröhrling']);
  });

  it('nennt, wie viele Arten die Liste gerade zeigt', async () => {
    const { aktualisiere } = await aufbauen();

    expect(screen.getByText('4 Arten')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mit Vorhersage' }));
    aktualisiere();

    // Ohne diese Zahl wirkte der Chip tot: die Liste steht nach Stufe, oben
    // bleiben dieselben Zeilen stehen.
    expect(screen.getByText('2 von 4 Arten')).toBeInTheDocument();
  });

  it('lässt die Verwechslungsprofile draußen, bis der Chip sie holt', async () => {
    const { aktualisiere, nachlade } = await aufbauen();

    // Wer den Katalog durchblättert, sucht etwas zum Sammeln.
    expect(namen()).not.toContain('Gallenröhrling');
    expect(screen.getByText('4 Arten')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Giftig und Verwechslung' }));
    nachlade('/api/arten?sammelbar=false', VERWECHSLUNG_LISTE);
    aktualisiere();

    expect(namen()).toEqual(['Gallenröhrling']);
    expect(screen.getByText('1 Arten')).toBeInTheDocument();
  });

  it('findet über die Suche auch einen Giftpilz und zeigt seine Stufe rot', async () => {
    const { aktualisiere, nachlade } = await aufbauen();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Gallen');
    nachlade('/api/arten?alle=true', ALLE_LISTE);
    aktualisiere();

    const zeile = screen.getByRole('button', { name: /Gallenröhrling/ });
    expect(within(zeile).getByText('Verwechslung')).toBeInTheDocument();
    expect(within(zeile).getByText('Giftig')).toBeInTheDocument();
  });

  it('nennt eine Art, deren Modell noch fehlt', async () => {
    await aufbauen();

    // Genug Funde für ein Modell, aber noch keine Karte.
    const zeile = screen.getByRole('button', { name: /Semmelstoppelpilz/ });
    expect(within(zeile).getByText('Vorhersage in Arbeit')).toBeInTheDocument();
    expect(
      within(screen.getByRole('button', { name: /Steinpilz/ })).queryByText('Vorhersage in Arbeit'),
    ).not.toBeInTheDocument();
  });

  it('zeigt einen Leerzustand, wenn nichts passt', async () => {
    const { aktualisiere, nachlade } = await aufbauen();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Trüffel');
    nachlade('/api/arten?alle=true', ALLE_LISTE);
    aktualisiere();

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
  });

  it('filtert über die Chips nach Stufe, Gruppe und Jahreszeit', async () => {
    const { aktualisiere } = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Mit Vorhersage' }));
    aktualisiere();
    expect(namen()).toEqual(['Maronenröhrling', 'Steinpilz']);

    await userEvent.click(screen.getByRole('button', { name: 'Röhrlinge' }));
    aktualisiere();
    expect(namen()).toEqual(['Maronenröhrling', 'Steinpilz']);

    await userEvent.click(screen.getByRole('button', { name: 'Herbst' }));
    aktualisiere();
    expect(namen()).toEqual(['Maronenröhrling', 'Steinpilz', 'Semmelstoppelpilz']);

    await userEvent.click(screen.getByRole('button', { name: 'Alle' }));
    aktualisiere();
    expect(namen()).toHaveLength(4);
  });

  it('hebt die aktive Art der Karte hervor', async () => {
    const { zustand, aktualisiere } = await aufbauen();

    zustand.waehle('maronenroehrling');
    aktualisiere();

    const zeile = screen.getByRole('button', { name: /Maronenröhrling/ });
    expect(zeile).toHaveAttribute('aria-current', 'true');
    expect(within(zeile).getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Steinpilz/ })).not.toHaveAttribute('aria-current');
  });

  it('wandert mit den Pfeiltasten und öffnet mit Enter', async () => {
    const { router } = await aufbauen();
    const gerufen = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    screen.getByRole('button', { name: /Maronenröhrling/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /Steinpilz/ })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('button', { name: /Speisemorchel/ })).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}{Enter}');

    expect(gerufen).toHaveBeenCalledWith(['/arten', 'semmelstoppelpilz']);
  });

  it('lässt andere Tasten in Ruhe', async () => {
    await aufbauen();

    const erste = screen.getByRole('button', { name: /Maronenröhrling/ });
    erste.focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(erste).toHaveFocus();
  });
});
