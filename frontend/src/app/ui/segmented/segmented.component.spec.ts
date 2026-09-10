import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SegmentedComponent, type SegmentOption } from './segmented.component';

const OPTIONEN: SegmentOption[] = [
  { value: 'vorhersage', label: 'Vorhersage' },
  { value: 'ebene', label: 'Ebene' },
  { value: 'kombination', label: 'Kombination' },
];

describe('SegmentedComponent', () => {
  it('führt die Wahl als tablist', async () => {
    const { container } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'ebene', label: 'Darstellung' },
    });

    expect(screen.getByRole('tablist', { name: 'Darstellung' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Vorhersage' })).toHaveAttribute('tabindex', '-1');
    await noViolations(container);
  });

  it('meldet einen Klick auf eine andere Wahl', async () => {
    const { fixture } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'ebene', label: 'Darstellung' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('tab', { name: 'Kombination' }));

    expect(selected).toEqual(['kombination']);
  });

  it('wechselt mit den Pfeiltasten und läuft dabei um', async () => {
    const { fixture } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'vorhersage', label: 'Darstellung' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));
    screen.getByRole('tab', { name: 'Vorhersage' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Enter}');

    expect(selected).toEqual(['ebene', 'kombination', 'vorhersage']);
  });
});
