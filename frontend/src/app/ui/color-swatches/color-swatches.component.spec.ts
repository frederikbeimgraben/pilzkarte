import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { ColorSwatchesComponent, OBJEKT_FARBEN, type Farbfeld } from './color-swatches.component';

const FARBEN: Farbfeld[] = [
  { wert: OBJEKT_FARBEN[0], label: 'Grün' },
  { wert: OBJEKT_FARBEN[1], label: 'Bronze' },
];

describe('ColorSwatchesComponent', () => {
  it('führt die Farben als Auswahlgruppe', async () => {
    const { container } = await render(ColorSwatchesComponent, {
      inputs: { farben: FARBEN, wert: OBJEKT_FARBEN[0], beschriftung: 'Farbe' },
    });

    expect(screen.getByRole('radiogroup', { name: 'Farbe' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grün' })).toHaveAttribute('aria-checked', 'true');
    await keineVerstoesse(container);
  });

  it('meldet die gewählte Farbe', async () => {
    const { fixture } = await render(ColorSwatchesComponent, {
      inputs: { farben: FARBEN, wert: OBJEKT_FARBEN[0], beschriftung: 'Farbe' },
    });
    const gewaehlt: string[] = [];
    fixture.componentInstance.wertChange.subscribe((wert) => gewaehlt.push(wert));

    await userEvent.click(screen.getByRole('radio', { name: 'Bronze' }));

    expect(gewaehlt).toEqual([OBJEKT_FARBEN[1]]);
  });
});
