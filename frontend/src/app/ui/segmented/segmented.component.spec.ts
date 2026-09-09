import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { SegmentedComponent, type SegmentOption } from './segmented.component';

const OPTIONEN: SegmentOption[] = [
  { wert: 'vorhersage', label: 'Vorhersage' },
  { wert: 'ebene', label: 'Ebene' },
  { wert: 'kombination', label: 'Kombination' },
];

describe('SegmentedComponent', () => {
  it('führt die Wahl als tablist', async () => {
    const { container } = await render(SegmentedComponent, {
      inputs: { optionen: OPTIONEN, wert: 'ebene', beschriftung: 'Darstellung' },
    });

    expect(screen.getByRole('tablist', { name: 'Darstellung' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Vorhersage' })).toHaveAttribute('tabindex', '-1');
    await keineVerstoesse(container);
  });

  it('meldet einen Klick auf eine andere Wahl', async () => {
    const { fixture } = await render(SegmentedComponent, {
      inputs: { optionen: OPTIONEN, wert: 'ebene', beschriftung: 'Darstellung' },
    });
    const gewaehlt: string[] = [];
    fixture.componentInstance.wertChange.subscribe((wert) => gewaehlt.push(wert));

    await userEvent.click(screen.getByRole('tab', { name: 'Kombination' }));

    expect(gewaehlt).toEqual(['kombination']);
  });

  it('wechselt mit den Pfeiltasten und läuft dabei um', async () => {
    const { fixture } = await render(SegmentedComponent, {
      inputs: { optionen: OPTIONEN, wert: 'vorhersage', beschriftung: 'Darstellung' },
    });
    const gewaehlt: string[] = [];
    fixture.componentInstance.wertChange.subscribe((wert) => gewaehlt.push(wert));
    screen.getByRole('tab', { name: 'Vorhersage' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Enter}');

    expect(gewaehlt).toEqual(['ebene', 'kombination', 'vorhersage']);
  });
});
