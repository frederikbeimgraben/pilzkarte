import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { FactorRowComponent } from './factor-row.component';

describe('FactorRowComponent', () => {
  it('zeigt Name, Bezug und Bedingung', async () => {
    const { container, fixture } = await render(FactorRowComponent, {
      inputs: {
        name: 'Niederschlag',
        unter: 'Summe KW 37 bis 40',
        bedingung: '≥ 80 mm',
        aktiv: true,
      },
    });
    // ngModel schreibt den Wert erst in einer Mikroaufgabe in das Feld.
    await fixture.whenStable();

    expect(screen.getByRole('checkbox', { name: /Niederschlag/ })).toBeChecked();
    expect(screen.getByRole('button', { name: '≥ 80 mm' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('meldet das Abwählen und den Griff zur Bedingung', async () => {
    const { fixture } = await render(FactorRowComponent, {
      inputs: { name: 'Boden pH', bedingung: '≤ 5,5', aktiv: true },
    });
    await fixture.whenStable();
    const geschaltet: boolean[] = [];
    let bedingung = 0;
    fixture.componentInstance.aktivChange.subscribe((wert) => geschaltet.push(wert));
    fixture.componentInstance.bedingungKlick.subscribe(() => (bedingung += 1));

    await userEvent.click(screen.getByRole('checkbox', { name: /Boden pH/ }));
    await userEvent.click(screen.getByRole('button', { name: '≤ 5,5' }));

    expect(geschaltet).toEqual([false]);
    expect(bedingung).toBe(1);
  });
});
