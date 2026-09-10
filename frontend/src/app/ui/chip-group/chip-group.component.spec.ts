import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ChipGroupComponent, type Chip } from './chip-group.component';

const CHIPS: Chip[] = [
  { value: 'alle', label: 'alle' },
  { value: 'vorhersage', label: 'mit Vorhersage' },
];

describe('ChipGroupComponent', () => {
  it('zeigt den gewählten Chip als gedrückt', async () => {
    const { container } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: 'alle', label: 'Arten' },
    });

    expect(screen.getByRole('button', { name: 'alle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'mit Vorhersage' })).toHaveAttribute('aria-pressed', 'false');
    await noViolations(container);
  });

  it('meldet den angetippten Chip', async () => {
    const { fixture } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: 'alle', label: 'Arten' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('button', { name: 'mit Vorhersage' }));

    expect(selected).toEqual(['vorhersage']);
  });
});
