import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { readLayers } from '../../core/tiles/layers';
import { RAW_LAYERS } from '../../testing/map-doubles';
import { FactorPickerComponent } from './factor-picker.component';

const LAYERS = readLayers(RAW_LAYERS).layers;

describe('FactorPickerComponent', () => {
  it('nennt jede freie Quelle mit Namen, Zeichen und Einheit', async () => {
    const { container } = await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS },
    });

    expect(screen.getByText('Waldanteil')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Faktor wählen' })).toHaveTextContent('Grad');
    expect(container.querySelectorAll('.row__icon')).toHaveLength(LAYERS.length);
    await noViolations(container);
  });

  it('lässt eine Quelle mit Faktor weg', async () => {
    await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS, assigned: new Set(['wald']) },
    });

    expect(screen.queryByText('Waldanteil')).toBeNull();
  });

  it('meldet die gewählte Ebene', async () => {
    const { fixture } = await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS },
    });
    const picks: string[] = [];
    fixture.componentInstance.chosen.subscribe((layer) => picks.push(layer.id));

    await userEvent.click(screen.getByRole('button', { name: /Waldanteil/ }));

    expect(picks).toEqual(['wald']);
  });

  it('blendet die Ränder der Karte aus', async () => {
    const { container } = await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS },
    });

    expect(container.querySelectorAll('.option-sheet__scroll > .scroll-fade')).toHaveLength(2);
  });
});
