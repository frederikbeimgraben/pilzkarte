import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Art } from '../../core/api/models';
import { MORCHEL, STEINPILZ } from '../../testing/arten-fixture';
import { keineVerstoesse } from '../../testing/axe';
import { ArtComponent } from './art.component';
import { ArtenZustand } from './arten.zustand';

interface Aufbau {
  container: Element;
  router: Router;
  zustand: ArtenZustand;
}

async function aufbauen(art: Art | 'fehlt', slug = 'steinpilz'): Promise<Aufbau> {
  const { container, detectChanges } = await render(ArtComponent, {
    inputs: { slug },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const anfrage = TestBed.inject(HttpTestingController).expectOne(`/api/arten/${slug}`);
  if (art === 'fehlt') {
    anfrage.flush(
      { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
  } else {
    anfrage.flush(art);
  }
  detectChanges();
  return { container, router: TestBed.inject(Router), zustand: TestBed.inject(ArtenZustand) };
}

describe('ArtComponent', () => {
  it('zeigt Kopf, Kurve, Merkmale, Verwechslung und Quellen', async () => {
    const { container } = await aufbauen(STEINPILZ);

    expect(screen.getByRole('heading', { level: 1, name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis · Röhrling')).toBeInTheDocument();
    expect(screen.getByText('Vorhersage')).toBeInTheDocument();
    expect(screen.getByText('geschützt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '123pilzsuche.de' })).toHaveAttribute(
      'href',
      'https://www.123pilzsuche.de/daten/details/Steinpilze.htm',
    );
    expect(screen.getByRole('link', { name: 'Wikipedia' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('stellt die Merkmale in der Reihenfolge der Artseite auf', async () => {
    const { container } = await aufbauen(STEINPILZ);

    const schluessel = [...container.querySelectorAll('.tz__schluessel')].map((zelle) =>
      zelle.textContent.trim(),
    );

    expect(schluessel).toEqual([
      'Hut',
      'Röhren',
      'Stiel',
      'Fleisch',
      'Geruch',
      'Geschmack',
      'Sporenpulver',
      'Vorkommen',
      'Zeit',
      'Speisewert',
      'Schutz',
      // Danach folgt die zweite Tabelle: die Verwechslungen.
      'Gallenröhrling',
      'Satansröhrling',
    ]);
  });

  it('zeigt den Speisewert und jede Verwechslung als Badge', async () => {
    await aufbauen(STEINPILZ);

    expect(screen.getByText('Speisepilz')).toBeInTheDocument();
    expect(screen.getByText('Ungenießbar')).toBeInTheDocument();
    expect(screen.getByText('Giftig')).toBeInTheDocument();
  });

  it('nennt zur Kurve die Jahre, die Wochen und den Höchstwert', async () => {
    const { container } = await aufbauen(STEINPILZ);

    expect(screen.getByText('2025 bis KW 39')).toBeInTheDocument();
    expect(screen.getByText('2015 bis 2024, Anteil der Begehungen mit Fund')).toBeInTheDocument();
    expect(screen.getByText('32 %')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dez')).toBeInTheDocument();
    // Das laufende Jahr endet mit einem Punkt auf der letzten vollen Woche.
    expect(container.querySelector('.funke__ende')).not.toBeNull();
  });

  it('springt auf die Karte und merkt die Art dort', async () => {
    const { router, zustand } = await aufbauen(STEINPILZ);
    const gerufen = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte anzeigen' }));

    expect(zustand.aktiveArt()).toBe('steinpilz');
    expect(gerufen).toHaveBeenCalledWith(['/karte'], {
      queryParams: { art: 'boletus_edulis', kw: 39 },
    });
  });

  it('zeigt ohne Vorhersage weder Kurve noch Sprung auf die Karte', async () => {
    const { container } = await aufbauen(MORCHEL, 'speisemorchel');

    expect(screen.getByText('Zu wenige Begehungen für eine Saisonkurve')).toBeInTheDocument();
    expect(container.querySelector('.funke')).toBeNull();
    expect(screen.getByRole('button', { name: 'Auf der Karte anzeigen' })).toBeDisabled();
    expect(screen.getByText('Für diese Art gibt es keine Vorhersage')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('führt aus einem 404 mit Zurück in die Liste', async () => {
    const { container, router } = await aufbauen('fehlt', 'gibtsnicht');
    const gerufen = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(screen.getByText('Diese Art steht nicht im Katalog.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(gerufen).toHaveBeenCalledWith(['/arten']);
    await keineVerstoesse(container);
  });

  it('führt der Zurück-Knopf einer gefundenen Art in die Liste', async () => {
    const { router } = await aufbauen(STEINPILZ);
    const gerufen = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const kopf = screen.getByRole('banner');
    await userEvent.click(within(kopf).getByRole('button', { name: 'Zurück' }));

    expect(gerufen).toHaveBeenCalledWith(['/arten']);
  });
});
