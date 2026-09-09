import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { ChipGroupComponent, type Chip } from './chip-group.component';

const CHIPS: Chip[] = [
  { wert: 'alle', label: 'alle' },
  { wert: 'vorhersage', label: 'mit Vorhersage' },
];

describe('ChipGroupComponent', () => {
  it('zeigt den gewählten Chip als gedrückt', async () => {
    const { container } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, wert: 'alle', beschriftung: 'Arten' },
    });

    expect(screen.getByRole('button', { name: 'alle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'mit Vorhersage' })).toHaveAttribute('aria-pressed', 'false');
    await keineVerstoesse(container);
  });

  it('meldet den angetippten Chip', async () => {
    const { fixture } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, wert: 'alle', beschriftung: 'Arten' },
    });
    const gewaehlt: string[] = [];
    fixture.componentInstance.wertChange.subscribe((wert) => gewaehlt.push(wert));

    await userEvent.click(screen.getByRole('button', { name: 'mit Vorhersage' }));

    expect(gewaehlt).toEqual(['vorhersage']);
  });
});
