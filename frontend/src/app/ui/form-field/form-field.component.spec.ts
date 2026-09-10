import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  it('verbindet Beschriftung und einzeiliges Feld', async () => {
    const { container, fixture } = await render(FormFieldComponent, {
      inputs: { label: 'Notiz', placeholder: 'optional' },
    });
    const inputs: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => inputs.push(value));

    await userEvent.type(screen.getByLabelText('Notiz'), 'ab');

    expect(inputs.at(-1)).toBe('ab');
    await noViolations(container);
  });

  it('nimmt mehrzeilige Eingaben an', async () => {
    const { container } = await render(FormFieldComponent, {
      inputs: { label: 'Notiz', multiline: true, value: 'Nordhang' },
    });

    expect(screen.getByLabelText('Notiz')).toHaveValue('Nordhang');
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('öffnet als reines Anzeigefeld eine Auswahl', async () => {
    const { container, fixture } = await render(FormFieldComponent, {
      inputs: { label: 'Art', value: 'Steinpilz', readOnly: true },
    });
    let calls = 0;
    fixture.componentInstance.displayClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('stellt ein Suchfeld mit Lupe und versteckter Beschriftung', async () => {
    const { container, fixture } = await render(FormFieldComponent, {
      inputs: { label: 'Art suchen', placeholder: 'Art suchen', icon: 'suche', hideLabel: true },
    });
    const inputs: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => inputs.push(value));

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Stein');

    expect(inputs.at(-1)).toBe('Stein');
    expect(container.querySelector('.field__label')).toHaveClass('sr-only');
    expect(container.querySelector('.field__icon')).not.toBeNull();
    await noViolations(container);
  });

  it('zeigt im leeren Anzeigefeld den Platzhalter', async () => {
    await render(FormFieldComponent, {
      inputs: { label: 'Anzahl', placeholder: 'optional', readOnly: true },
    });

    expect(screen.getByRole('button', { name: 'optional' })).toBeInTheDocument();
  });
  it('nimmt Datum und Zahl als eigene Art des Feldes', async () => {
    const { container, rerender } = await render(FormFieldComponent, {
      inputs: { label: 'Datum', kind: 'date' as const, value: '2026-09-06' },
    });

    expect(container.querySelector('input')).toHaveAttribute('type', 'date');

    await rerender({ inputs: { label: 'Anzahl', kind: 'number' as const, value: '3' } });

    expect(container.querySelector('input')).toHaveAttribute('type', 'number');
  });
});
