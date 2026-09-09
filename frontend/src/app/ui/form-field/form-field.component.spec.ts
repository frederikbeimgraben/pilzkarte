import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  it('verbindet Beschriftung und einzeiliges Feld', async () => {
    const { container, fixture } = await render(FormFieldComponent, {
      inputs: { label: 'Notiz', platzhalter: 'optional' },
    });
    const eingaben: string[] = [];
    fixture.componentInstance.wertChange.subscribe((wert) => eingaben.push(wert));

    await userEvent.type(screen.getByLabelText('Notiz'), 'ab');

    expect(eingaben.at(-1)).toBe('ab');
    await keineVerstoesse(container);
  });

  it('nimmt mehrzeilige Eingaben an', async () => {
    const { container } = await render(FormFieldComponent, {
      inputs: { label: 'Notiz', mehrzeilig: true, wert: 'Nordhang' },
    });

    expect(screen.getByLabelText('Notiz')).toHaveValue('Nordhang');
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('öffnet als reines Anzeigefeld eine Auswahl', async () => {
    const { container, fixture } = await render(FormFieldComponent, {
      inputs: { label: 'Art', wert: 'Steinpilz', nurAnzeige: true },
    });
    let gerufen = 0;
    fixture.componentInstance.anzeigeKlick.subscribe(() => (gerufen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(gerufen).toBe(1);
    await keineVerstoesse(container);
  });

  it('zeigt im leeren Anzeigefeld den Platzhalter', async () => {
    await render(FormFieldComponent, {
      inputs: { label: 'Anzahl', platzhalter: 'optional', nurAnzeige: true },
    });

    expect(screen.getByRole('button', { name: 'optional' })).toBeInTheDocument();
  });
});
