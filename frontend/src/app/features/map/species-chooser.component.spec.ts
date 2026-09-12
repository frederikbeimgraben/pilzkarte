import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SPECIES_LIST, BAY_BOLETE_BRIEF } from '../../testing/species-fixture';
import type { SpeciesCatalogue } from '../../core/api/models';
import { SpeciesChooserComponent } from './species-chooser.component';

/**
 * Der Pfifferling wird gezeichnet, der Maronenröhrling der Fixture nicht: sein
 * Kartenschlüssel gehört zu keinem Kachelordner.
 */
const PFIFFERLING = {
  ...BAY_BOLETE_BRIEF,
  slug: 'pfifferling',
  name: 'Pfifferling',
  lateinisch: 'Cantharellus cibarius',
  kartenSlug: 'pfifferling',
};

const LIST: SpeciesCatalogue = { ...SPECIES_LIST, arten: [...SPECIES_LIST.arten, PFIFFERLING] };

function sheet(selected: string | null = 'boletus_edulis') {
  return render(SpeciesChooserComponent, { inputs: { catalogue: LIST, selected } });
}

describe('SpeciesChooserComponent', () => {
  it('zeigt nur Arten mit Karte und markiert die aktuelle', async () => {
    const { container } = await sheet();

    expect(screen.getByRole('dialog', { name: 'Art für die Karte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Steinpilz/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Pfifferling/ })).not.toHaveAttribute('aria-pressed');
    // Ohne Kacheln keine Zeile: Semmelstoppelpilz und Speisemorchel haben gar
    // keine Karte, der Maronenröhrling einen Schlüssel ohne Kachelordner.
    expect(screen.queryByRole('button', { name: /Semmelstoppelpilz/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Speisemorchel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maronenröhrling/ })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('sucht über Namen und lateinischen Namen', async () => {
    await sheet();
    const field = screen.getByRole('textbox', { name: 'Art suchen' });

    await userEvent.type(field, 'cibarius');

    expect(screen.getByRole('button', { name: /Pfifferling/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Steinpilz/ })).not.toBeInTheDocument();
  });

  it('nennt die leere Suche beim Namen', async () => {
    await sheet();

    await userEvent.type(screen.getByRole('textbox', { name: 'Art suchen' }), 'Trüffel');

    expect(screen.getByText('Keine Art mit Karte passt zur Suche.')).toBeInTheDocument();
  });

  it('meldet die gewählte Art mit ihrem Kartenschlüssel', async () => {
    const { fixture } = await sheet();
    const selected: string[] = [];
    fixture.componentInstance.chosen.subscribe((slug) => selected.push(slug));

    await userEvent.click(screen.getByRole('button', { name: /Pfifferling/ }));

    expect(selected).toEqual(['pfifferling']);
  });

  it('führt in den Katalog und lässt sich abbrechen', async () => {
    const { fixture } = await sheet();
    let katalog = 0;
    let closed = 0;
    fixture.componentInstance.zumKatalog.subscribe(() => (katalog += 1));
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Alle Arten ansehen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(katalog).toBe(1);
    expect(closed).toBe(1);
  });

  it('unterscheidet die leere Suche von der leeren Liste', async () => {
    await render(SpeciesChooserComponent, { inputs: { catalogue: null, selected: null } });

    expect(screen.getByText('Die Arten werden geladen.')).toBeInTheDocument();
  });
});
