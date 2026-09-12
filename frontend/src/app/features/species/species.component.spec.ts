import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Species, SpeciesImage } from '../../core/api/models';
import { GALLENROEHRLING, MORCHEL, STEINPILZ } from '../../testing/species-fixture';
import { speciesImage } from '../../testing/species-images-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { SpeciesComponent } from './species.component';
import { MapState } from '../map/map.state';
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
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      ...authStubProviders(new AuthStub()),
    ],
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
    // Die Artseite trägt seit D4b sechs Abschnitte mehr; axe braucht dafür
    // mehr als die fünf Sekunden, die eine Prüfung sonst genügen.
  }, 30_000);

  it('stellt die Merkmale in der Reihenfolge der Artseite auf', async () => {
    const { container } = await build(STEINPILZ);

    const schluessel = [...container.querySelectorAll('.tz__key')].map((cell) => cell.textContent.trim());

    expect(schluessel).toEqual([
      // Erst die Einstufung, dann die Werte, dann die Farben.
      'Speisewert',
      'Schutz',
      'Handel',
      'Hut',
      'Sporen',
      'Sporen',
      // Hut und Stiel, dann die Fruchtschicht mit der Farbe ihres Sporenlagers.
      'Form',
      'Merkmale',
      'Rand',
      'Merkmale',
      'Art',
      'Farbe',
      'Hut',
      'Stiel',
      'Sporenpulver',
      'Auf Druck oder im Schnitt',
      // Danach die Merkmalstabelle, wie gehabt.
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

  it('stellt die Einstufung als Stufe, Schutz und Handel', async () => {
    const { container } = await build(STEINPILZ);

    // Die Stufe trägt ihre eigene Farbe: sie warnt, bevor man das Wort liest.
    const pill = container.querySelector<HTMLElement>('.level');
    expect(pill?.textContent.trim()).toBe('Essbar');
    expect(pill?.style.getPropertyValue('--pilz-level-colour')).toBe('#4f9d6f');
    expect(screen.getByText('für den Eigenbedarf')).toBeInTheDocument();
    expect(screen.getByText('auf der Positivliste')).toBeInTheDocument();
  });

  it('zeigt jedes Maß mit Zeichen, Zahl und Einheit', async () => {
    await build(STEINPILZ);

    expect(screen.getByRole('img', { name: 'Hutbreite' })).toBeInTheDocument();
    // Die Spore trägt ihr eigenes Zeichen, nicht das des Hutes.
    expect(screen.getAllByRole('img', { name: 'Sporenlänge' })).toHaveLength(2);
    expect(screen.getByText('4 – 20')).toBeInTheDocument();
    expect(screen.getByText('12,4 – 19,2')).toBeInTheDocument();
    // Zwei Zeilen heißen „Sporen“; erst dann sagt die Unterzeile, welche gemeint ist.
    expect(screen.getByText('Länge')).toBeInTheDocument();
    expect(screen.getByText('Breite')).toBeInTheDocument();
  });

  it('nennt den selteneren Wert als Wort, nicht als zweite Zahl', async () => {
    await build(STEINPILZ);

    expect(screen.getByText('selten bis 25 cm')).toBeInTheDocument();
  });

  it('zeigt die Hutform als Entwicklung, ohne Zeichen', async () => {
    await build(STEINPILZ);

    // Das Kuhmaul ist jung gewölbt und alt verflacht; ein Wert trägt das nicht.
    expect(screen.getByText('halbkugelig, später gewölbt')).toBeInTheDocument();
    expect(screen.getByText('hygrophan')).toBeInTheDocument();
    expect(screen.getByText('eingerollt')).toBeInTheDocument();
  });

  it('nennt eine Form ohne Veränderung nur einmal', async () => {
    await build({ ...STEINPILZ, hutform: { von: 'muschelfoermig', nach: null } });

    expect(screen.getByText('muschelförmig')).toBeInTheDocument();
  });

  it('zählt die Stielmerkmale auf', async () => {
    await build(STEINPILZ);

    expect(screen.getByRole('heading', { name: 'Stiel' })).toBeInTheDocument();
    expect(screen.getByText('genetzt, voll')).toBeInTheDocument();
  });

  it('lässt Hut und Stiel weg, solange die Quelle nichts hergibt', async () => {
    const { container } = await build({
      ...STEINPILZ,
      hutform: null,
      hutmerkmale: [],
      hutrand: null,
      stielmerkmale: [],
    });

    expect(screen.queryByRole('heading', { name: 'Stiel' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('eingerollt');
  });

  it('nennt die Fruchtschicht mit dem Wort, ohne Zeichen', async () => {
    const { container } = await build(STEINPILZ);

    // Der Sachverhalt lässt sich bei 24 px nicht zeichnen; das Wort trägt.
    const heading = screen.getByRole('heading', { name: 'Fruchtschicht' });
    const section = heading.parentElement;
    expect(section).not.toBeNull();
    expect(within(section ?? heading).getByText('Röhren')).toBeInTheDocument();
    // Röhren haben keinen Ansatz am Stiel, also steht die Zeile nicht da.
    expect(container.textContent).not.toContain('Ansatz am Stiel');
  });

  it('gibt Lamellen Ansatz, Stand und Schneide dazu', async () => {
    await build({
      ...STEINPILZ,
      fruchtschicht: { art: 'lamellen', ansatz: 'frei', stand: 'eng', schneide: 'glatt' },
    });

    expect(screen.getByText('Lamellen')).toBeInTheDocument();
    expect(screen.getByText('frei')).toBeInTheDocument();
    expect(screen.getByText('eng')).toBeInTheDocument();
    expect(screen.getByText('glatt')).toBeInTheDocument();
  });

  it('zeigt jede Farbe als Fläche, das Wort daneben', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByText('hellbraun, dunkelbraun')).toBeInTheDocument();
    const field = screen.getByRole('img', { name: 'Farbe: hellbraun, dunkelbraun' });
    expect(field).toHaveStyle({
      background: 'linear-gradient(104deg,#e2c79a 0% 50%,#6b4423 50% 100%)',
    });
    // Ein Körperteil ohne Farbe steht nicht da.
    expect(container.textContent).not.toContain('Fleisch:');
  });

  it('zeigt die Verfärbung als von, Pfeil, nach und Dauer', async () => {
    await build(STEINPILZ);

    expect(screen.getByRole('img', { name: 'wird zu' })).toBeInTheDocument();
    expect(screen.getByText('sofort')).toBeInTheDocument();
  });

  it('zeichnet die Zeit als Bahn und nennt beide Zeiträume', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByText('Juni bis November · beobachtet August bis Oktober')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Wachstum von Juni bis November, am häufigsten August bis Oktober',
      }),
    ).toBeInTheDocument();
    // Genannte Zeit blass, gemessene Zeit kräftig.
    expect(container.querySelectorAll('.year__body')).toHaveLength(2);
    expect(container.querySelectorAll('.year__body--muted')).toHaveLength(1);
  });

  it('stellt Geruch und Geschmack als Kategorien neben den Satz', async () => {
    await build(STEINPILZ);

    expect(screen.getByRole('list', { name: 'Geruch' })).toBeInTheDocument();
    expect(screen.getByText('pilzig')).toBeInTheDocument();
    expect(screen.getByText('Sehr angenehm, pilzig.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Geschmack' })).toBeInTheDocument();
    expect(screen.getByText('Mild und nussig.')).toBeInTheDocument();
  });

  it('zeigt den Speisewert und jede Verwechslung als Badge', async () => {
    await build(STEINPILZ);

    expect(screen.getAllByText('Essbar').length).toBeGreaterThan(0);
    expect(screen.getByText('Ungenießbar')).toBeInTheDocument();
    expect(screen.getByText('Giftig')).toBeInTheDocument();
  });

  it('nennt zur Kurve die Jahre, die Wochen und den Höchstwert', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByText('Schätzung dieses Jahr')).toBeInTheDocument();
    expect(screen.getByText('Mittelwert 2015 bis 2024')).toBeInTheDocument();
    expect(screen.getByText('32 %')).toBeInTheDocument();
    // Die Kurve und die Jahresbahn tragen beide eine Marke für Januar.
    expect(screen.getAllByText('Jan').length).toBe(2);
    expect(screen.getByText('Dez')).toBeInTheDocument();
    // Das laufende Jahr endet mit einem Punkt auf der letzten vollen Woche.
    expect(container.querySelector('.spark__end')).not.toBeNull();
  });

  it('zeigt die geprüften Angaben mit Quelle', async () => {
    await build(STEINPILZ);

    expect(screen.getByText('Auf der Positivliste der DGfM Stand 10. September 2026')).toBeInTheDocument();
    expect(screen.getByText('Häufig')).toBeInTheDocument();
    // Die Maße stehen als eigener Abschnitt, nicht mehr als Satz in der Tabelle.
    expect(screen.getByText('4 – 20')).toBeInTheDocument();
    expect(screen.getByText('selten bis 25 cm')).toBeInTheDocument();
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

  it('verlinkt jede Verwechslung auf ihr eigenes Profil', async () => {
    await build(STEINPILZ);

    // Jedes Paar zeigt auf ein Profil, seit der Katalog nur noch Verweise hält.
    // Der Weg ist das Zeichen rechts in der Zeile, nicht mehr der Name.
    expect(screen.getByRole('link', { name: 'Gallenröhrling ansehen' })).toHaveAttribute(
      'href',
      '/arten/gallenroehrling',
    );
    expect(screen.getByRole('link', { name: 'Satansröhrling ansehen' })).toHaveAttribute(
      'href',
      '/arten/satansroehrling',
    );
  });

  it('zeigt die Hutfarben des Partners in der Verwechslungszeile', async () => {
    await build(STEINPILZ);

    // Der Vertrag trägt die Farben mit. Ohne sie müsste die Seite für fünf
    // Farbflächen fünf Profile nachladen.
    expect(screen.getByRole('img', { name: 'Farbe: hellbraun' })).toBeInTheDocument();
  });

  it('lässt das Farbfeld weg, wo die Quelle keine Hutfarbe nennt', async () => {
    const { container } = await build(STEINPILZ);

    const rows = Array.from(container.querySelectorAll('app-lookalike-row'));
    const satan = rows.find((row) => row.textContent.includes('Satansröhrling'));
    expect(satan).toBeDefined();
    expect(satan?.querySelector('app-colour-field')).toBeNull();
  });

  it('warnt bei einer giftigen Art groß und mit Symbol', async () => {
    const { container } = await build(GALLENROEHRLING, 'gallenroehrling');

    expect(screen.getByText('Giftig. Diese Art gehört nicht in die Pfanne.')).toBeInTheDocument();
    expect(container.querySelector('.species__warnung app-svg-icon')).not.toBeNull();
    await noViolations(container);
  }, 30_000);

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
  }, 30_000);

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
    expect(TestBed.inject(MapState).art()).toBe('boletus_edulis');
    expect(calls).toHaveBeenCalledWith(['/karte']);
  });

  it('zeigt ohne Vorhersage weder Kurve noch Sprung auf die Karte', async () => {
    const { container } = await build(MORCHEL, 'speisemorchel');

    expect(screen.getByText('Zu wenige Begehungen für eine Saisonkurve')).toBeInTheDocument();
    expect(container.querySelector('.spark')).toBeNull();
    expect(screen.getByRole('button', { name: 'Auf der Karte anzeigen' })).toBeDisabled();
    expect(screen.getByText('Für diese Art gibt es keine Vorhersage')).toBeInTheDocument();
    await noViolations(container);
  }, 30_000);

  it('führt aus einem 404 mit Zurück in die Liste', async () => {
    const { container, router } = await build('fehlt', 'gibtsnicht');
    const calls = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(screen.getByText('Diese Art steht nicht im Katalog.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(calls).toHaveBeenCalledWith(['/arten']);
    await noViolations(container);
  }, 30_000);

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
    // Wie oben: die Artseite ist mit den Abschnitten aus D4b länger geworden.
  }, 30_000);

  it('zeigt zu einer Art ohne Bild den Leerzustand statt eines leeren Rahmens', async () => {
    const { container } = await build(STEINPILZ);

    expect(screen.getByText('Zu dieser Art gibt es noch kein Bild.')).toBeInTheDocument();
    expect(container.querySelector('.gallery__lead')).toBeNull();
  });
});
