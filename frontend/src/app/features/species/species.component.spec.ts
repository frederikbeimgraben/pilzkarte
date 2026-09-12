import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Species, SpeciesImage } from '../../core/api/models';
import { GALLENROEHRLING, MORCHEL, STEINPILZ } from '../../testing/species-fixture';
import { speciesImage } from '../../testing/species-images-fixture';
import { noViolations } from '../../testing/axe';
import { SpeciesComponent } from './species.component';
import { SpeciesState } from './species.state';

interface Setup {
  container: Element;
  router: Router;
  state: SpeciesState;
  refresh: () => void;
}

async function build(
  art: Species | 'fehlt',
  slug = 'steinpilz',
  images: SpeciesImage[] = [],
): Promise<Setup> {
  const { container, detectChanges } = await render(SpeciesComponent, {
    inputs: { slug },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const http = TestBed.inject(HttpTestingController);
  const request = http.expectOne(`/api/arten/${slug}`);
  if (art === 'fehlt') {
    request.flush(
      { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
  } else {
    request.flush(art);
  }
  // Die Bilder kommen aus einer zweiten Anfrage: das Profil liegt als TOML
  // beim Dienst, die Bilder stehen in der Datenbank.
  http.expectOne(`/api/species-images?species=${slug}`).flush(images);
  detectChanges();
  return {
    container,
    router: TestBed.inject(Router),
    state: TestBed.inject(SpeciesState),
    refresh: detectChanges,
  };
}

describe('ArtComponent', () => {
  it('zeigt Kopf, Kurve, Merkmale, Verwechslung und Quellen', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByRole('heading', { level: 1, name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis · Röhrling')).toBeInTheDocument();
    expect(screen.getByText('Vorhersage')).toBeInTheDocument();
    expect(screen.getByText('Geschützt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '123pilzsuche.de' })).toHaveAttribute(
      'href',
      'https://www.123pilzsuche.de/daten/details/Steinpilze.htm',
    );
    expect(screen.getByRole('link', { name: 'Wikipedia' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt die Merkmale in der Reihenfolge der Artseite auf', async () => {
    const { container } = await build(STEINPILZ);

    const schluessel = [...container.querySelectorAll('.tz__key')].map((cell) => cell.textContent.trim());

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
      // Die geprüften Angaben hängen am Speisewert: dieselbe Frage, was die Art wert ist.
      'Speisewert',
      'Wertigkeit',
      'Marktfähigkeit',
      'Häufigkeit',
      'Schutz',
      'Maße',
      'Weitere Namen',
      'Synonyme',
      // Danach die eigene Tabelle der Reagenzien. Die Verwechslungen stehen in
      // einem eigenen Baustein, weil ihre Marke eine eigene Zeile braucht.
      'Kalilauge (KOH)',
    ]);
    const partner = [...container.querySelectorAll('.lookalike__name')].map((cell) =>
      cell.textContent.trim(),
    );
    expect(partner).toEqual(['Gallenröhrling', 'Satansröhrling']);
  });

  it('zeigt den Speisewert und jede Verwechslung als Badge', async () => {
    await build(STEINPILZ);

    expect(screen.getAllByText('Guter Speisepilz').length).toBeGreaterThan(0);
    expect(screen.getByText('Ungenießbar')).toBeInTheDocument();
    expect(screen.getByText('Giftig')).toBeInTheDocument();
  });

  it('nennt zur Kurve die Jahre, die Wochen und den Höchstwert', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByText('Schätzung dieses Jahr')).toBeInTheDocument();
    expect(screen.getByText('Mittelwert 2015 bis 2024')).toBeInTheDocument();
    expect(screen.getByText('32 %')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dez')).toBeInTheDocument();
    // Das laufende Jahr endet mit einem Punkt auf der letzten vollen Woche.
    expect(container.querySelector('.spark__end')).not.toBeNull();
  });

  it('zeigt die geprüften Angaben mit Quelle', async () => {
    await build(STEINPILZ);

    expect(screen.getByText('Auf der Positivliste der DGfM Stand 1. Mai 2026')).toBeInTheDocument();
    expect(screen.getByText('Häufig')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Hut 4 bis 20, selten bis 25 cm breit · Sporen 12,4 bis 19,2 µm lang · Sporen 4,5 bis 5,5 µm breit',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Herrenpilz, Fichtensteinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus bulbosus')).toBeInTheDocument();
    expect(screen.getByText(/Angaben geprüft am 10. September 2026/)).toBeInTheDocument();
  });

  it('zeichnet die Wertigkeit als Skala von sechs Stufen', async () => {
    const { container } = await build(STEINPILZ);

    // Eine gefüllte Strecke von links wäre falsch herum: 1 ist die beste Stufe.
    expect(container.querySelectorAll('.species__step')).toHaveLength(6);
    expect(container.querySelectorAll('.species__step--erreicht')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Wertigkeit 1 von 6' })).toBeInTheDocument();
    expect(screen.getByText('Stufe 1 von 6 · 1 ist die beste')).toBeInTheDocument();
  });

  it('stellt die Reagenzien als eigene Tabelle', async () => {
    await build(STEINPILZ);

    expect(screen.getByRole('heading', { name: 'Reagenzien' })).toBeInTheDocument();
    expect(screen.getByText('Fleisch blass braun.')).toBeInTheDocument();
  });

  it('verlinkt eine Verwechslung auf ihr eigenes Profil', async () => {
    await build(STEINPILZ);

    // Der Satansröhrling hat kein eigenes Profil, der Gallenröhrling schon.
    expect(screen.getByRole('link', { name: 'Gallenröhrling' })).toHaveAttribute(
      'href',
      '/arten/gallenroehrling',
    );
    expect(screen.queryByRole('link', { name: 'Satansröhrling' })).not.toBeInTheDocument();
  });

  it('warnt bei einer giftigen Art groß und mit Symbol', async () => {
    const { container } = await build(GALLENROEHRLING, 'gallenroehrling');

    expect(screen.getByText('Giftig. Diese Art gehört nicht in die Pfanne.')).toBeInTheDocument();
    expect(container.querySelector('.species__warnung app-svg-icon')).not.toBeNull();
    await noViolations(container);
  });

  it('nimmt einem Verwechslungsprofil Saison und Karte, gibt ihm den Rückweg', async () => {
    const { container } = await build(GALLENROEHRLING, 'gallenroehrling');

    expect(
      screen.getByText(
        'Diese Art wird nicht gesammelt. Sie steht im Katalog, weil sammelbare Arten ihr ähnlich sehen.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Saison' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Auf der Karte anzeigen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zu den Arten' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt vom Verwechslungsprofil zu der Art zurück, von der man kam', async () => {
    const { router, state, refresh } = await build(GALLENROEHRLING, 'gallenroehrling');
    state.setOrigin({ slug: 'steinpilz', name: 'Steinpilz' });
    refresh();
    const calls = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zu Steinpilz' }));

    expect(calls).toHaveBeenCalledWith(['/arten', 'steinpilz']);
  });

  it('springt auf die Karte und merkt die Art dort', async () => {
    const { router, state } = await build(STEINPILZ);
    const calls = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte anzeigen' }));

    expect(state.activeSpecies()).toBe('steinpilz');
    expect(calls).toHaveBeenCalledWith(['/karte'], {
      queryParams: { art: 'boletus_edulis', kw: 39 },
    });
  });

  it('zeigt ohne Vorhersage weder Kurve noch Sprung auf die Karte', async () => {
    const { container } = await build(MORCHEL, 'speisemorchel');

    expect(screen.getByText('Zu wenige Begehungen für eine Saisonkurve')).toBeInTheDocument();
    expect(container.querySelector('.spark')).toBeNull();
    expect(screen.getByRole('button', { name: 'Auf der Karte anzeigen' })).toBeDisabled();
    expect(screen.getByText('Für diese Art gibt es keine Vorhersage')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt aus einem 404 mit Zurück in die Liste', async () => {
    const { container, router } = await build('fehlt', 'gibtsnicht');
    const calls = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(screen.getByText('Diese Art steht nicht im Katalog.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(calls).toHaveBeenCalledWith(['/arten']);
    await noViolations(container);
  });

  it('führt der Zurück-Knopf einer gefundenen Art in die Liste', async () => {
    const { router } = await build(STEINPILZ);
    const calls = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const head = screen.getByRole('banner');
    await userEvent.click(within(head).getByRole('button', { name: 'Zurück' }));

    expect(calls).toHaveBeenCalledWith(['/arten']);
  });

  it('stellt das Titelbild über die Art und nennt Fotograf und Lizenz', async () => {
    const { container } = await build(STEINPILZ, 'steinpilz', [speciesImage()]);

    const lead = container.querySelector('.gallery__lead img');
    expect(lead).toHaveAttribute('src', '/api/species-images/bild-eins/full');
    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt zu einer Art ohne Bild den Leerzustand statt eines leeren Rahmens', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByText('Zu dieser Art gibt es noch kein Bild.')).toBeInTheDocument();
    expect(container.querySelector('.gallery__lead')).toBeNull();
  });
});
