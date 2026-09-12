import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { CheckRowComponent } from './check-row.component';

describe('CheckRowComponent', () => {
  it('zeigt Titel und Unterzeile und meldet den Haken', async () => {
    const { container, fixture } = await render(CheckRowComponent, {
      inputs: { titel: 'Profile ändern', subline: 'Merkmale, Verwechslungen, Quellen' },
    });
    const seen: boolean[] = [];
    fixture.componentInstance.toggled.subscribe((value) => seen.push(value));

    expect(screen.getByText('Merkmale, Verwechslungen, Quellen')).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('checkbox', { name: /Profile ändern/ }));

    expect(seen).toEqual([true]);
  });

  it('lässt sich nicht umschalten, solange die Zeile gesperrt ist', async () => {
    const { fixture } = await render(CheckRowComponent, {
      inputs: { titel: 'Texte ändern', checked: true, disabled: true },
    });
    let calls = 0;
    fixture.componentInstance.toggled.subscribe(() => (calls += 1));

    const box = screen.getByRole('checkbox', { name: /Texte ändern/ });
    await userEvent.click(box);

    expect(box).toBeDisabled();
    expect(box).toBeChecked();
    expect(calls).toBe(0);
  });
});
