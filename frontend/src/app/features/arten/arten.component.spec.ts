import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { keineVerstoesse } from '../../testing/axe';
import { ArtenComponent } from './arten.component';
import { ArtenZustand } from './arten.zustand';

interface Aufbau {
  container: Element;
  router: Router;
  zustand: ArtenZustand;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  const { container, detectChanges } = await render(ArtenComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(ARTEN_LISTE);
  detectChanges();
  return {
    container,
    router: TestBed.inject(Router),
    zustand: TestBed.inject(ArtenZustand),
    aktualisiere: detectChanges,
  };
}

/** Die Namen der sichtbaren Zeilen, gelesen aus der Beschriftung ihrer Kurve. */
function namen(): string[] {
  return screen
    .getAllByRole('img')
    .map((kurve) => /^Saisonkurve (.+?),/.exec(kurve.getAttribute('aria-label') ?? '')?.[1] ?? '');
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
    const { aktualisiere } = await aufbauen();
    const feld = screen.getByLabelText('Art suchen');

    await userEvent.type(feld, 'morch');
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

  it('zeigt einen Leerzustand, wenn nichts passt', async () => {
    const { aktualisiere } = await aufbauen();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Trüffel');
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
