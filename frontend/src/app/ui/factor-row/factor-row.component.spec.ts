import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { FactorRowComponent } from './factor-row.component';

describe('FactorRowComponent', () => {
  it('zeigt Name, Bezug und Bedingung', async () => {
    const { container, fixture } = await render(FactorRowComponent, {
      inputs: {
        name: 'Niederschlag',
        subline: 'Summe KW 37 bis 40',
        condition: '≥ 80 mm',
        active: true,
      },
    });
    // ngModel schreibt den Wert erst in einer Mikroaufgabe in das Feld.
    await fixture.whenStable();

    expect(screen.getByRole('checkbox', { name: /Niederschlag/ })).toBeChecked();
    expect(screen.getByRole('button', { name: '≥ 80 mm' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet das Abwählen und den Griff zur Bedingung', async () => {
    const { fixture } = await render(FactorRowComponent, {
      inputs: { name: 'Boden pH', condition: '≤ 5,5', active: true },
    });
    await fixture.whenStable();
    const toggled: boolean[] = [];
    let condition = 0;
    fixture.componentInstance.activeChange.subscribe((value) => toggled.push(value));
    fixture.componentInstance.conditionClick.subscribe(() => (condition += 1));

    await userEvent.click(screen.getByRole('checkbox', { name: /Boden pH/ }));
    await userEvent.click(screen.getByRole('button', { name: '≤ 5,5' }));

    expect(toggled).toEqual([false]);
    expect(condition).toBe(1);
  });
});
