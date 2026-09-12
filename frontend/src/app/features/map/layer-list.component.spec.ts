import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { readLayers, type Layer } from '../../core/tiles/layers';
import { RAW_LAYERS } from '../../testing/map-doubles';
import { LayerListComponent } from './layer-list.component';

const LAYERS = readLayers(RAW_LAYERS).layers;

describe('EbenenListeComponent', () => {
  it('zeigt beide Gruppen mit Einheit und markiert die Wahl', async () => {
    const { container } = await render(LayerListComponent, {
      inputs: { layers: LAYERS, selected: 'wald', label: 'Eingabe-Ebenen' },
    });

    expect(screen.getByText('Je Woche')).toBeInTheDocument();
    expect(screen.getByText('Fest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Waldanteil/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Boden-pH/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Eingabe-Ebenen' })).toHaveTextContent('Grad');
    await noViolations(container);
  });

  it('gibt jeder Ebene ihr Zeichen', async () => {
    const { container } = await render(LayerListComponent, {
      inputs: { layers: LAYERS, label: 'Eingabe-Ebenen' },
    });

    // Niederschlag trägt das Kalenderblatt, der Wald den Baum: vier Ebenen,
    // vier Zeichen, keins doppelt in dieser Auswahl.
    expect(container.querySelectorAll('.layers__glyph svg')).toHaveLength(4);
  });

  it('meldet die gewählte Ebene', async () => {
    const { fixture } = await render(LayerListComponent, {
      inputs: { layers: LAYERS, label: 'Eingabe-Ebenen' },
    });
    const selected: Layer[] = [];
    fixture.componentInstance.chosen.subscribe((layer) => selected.push(layer));

    await userEvent.click(screen.getByRole('button', { name: /Mitteltemperatur/ }));

    expect(selected[0].id).toBe('temperatur');
  });

  it('lässt eine leere Gruppe weg', async () => {
    await render(LayerListComponent, {
      inputs: {
        layers: LAYERS.filter((layer) => layer.fixed),
        label: 'Eingabe-Ebenen',
      },
    });

    expect(screen.queryByText('Je Woche')).not.toBeInTheDocument();
    expect(screen.getByText('Fest')).toBeInTheDocument();
  });
});
