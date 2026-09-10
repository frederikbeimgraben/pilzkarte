import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ColorSwatchesComponent, OBJECT_COLORS, type ColorSwatch } from './color-swatches.component';

const COLORS: ColorSwatch[] = [
  { value: OBJECT_COLORS[0], label: 'Grün' },
  { value: OBJECT_COLORS[1], label: 'Bronze' },
];

describe('ColorSwatchesComponent', () => {
  it('führt die Farben als Auswahlgruppe', async () => {
    const { container } = await render(ColorSwatchesComponent, {
      inputs: { colors: COLORS, value: OBJECT_COLORS[0], label: 'Farbe' },
    });

    expect(screen.getByRole('radiogroup', { name: 'Farbe' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grün' })).toHaveAttribute('aria-checked', 'true');
    await noViolations(container);
  });

  it('meldet die gewählte Farbe', async () => {
    const { fixture } = await render(ColorSwatchesComponent, {
      inputs: { colors: COLORS, value: OBJECT_COLORS[0], label: 'Farbe' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('radio', { name: 'Bronze' }));

    expect(selected).toEqual([OBJECT_COLORS[1]]);
  });
});
