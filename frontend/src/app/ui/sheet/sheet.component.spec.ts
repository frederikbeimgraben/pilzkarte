import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { SheetComponent } from './sheet.component';

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet beschriftung="Steinpilz" [raste]="1" [modal]="true" [griffTipp]="true">
      <button type="button">erste</button>
      <button type="button">zweite</button>
    </app-sheet>
  `,
})
class WirtComponent {}

describe('SheetComponent', () => {
  it('ist ein Dialog mit Griff und Inhalt', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', griffTipp: true },
    });

    expect(screen.getByRole('dialog', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blatt greifen' })).toBeInTheDocument();
    expect(screen.getByText('Tippen wechselt die Raste.')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('geht beim Tipp auf den Griff zur nächsten Raste und wieder von vorn', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 2 },
    });
    const gerufen: number[] = [];
    fixture.componentInstance.rasteChange.subscribe((raste) => gerufen.push(raste));

    await userEvent.click(screen.getByRole('button', { name: 'Blatt greifen' }));

    expect(gerufen).toEqual([0]);
  });

  it('setzt die Höhe der gewählten Raste', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 2, rasten: [0.1, 0.5, 0.9] },
    });

    expect(container.querySelector<HTMLElement>('.blatt')?.style.blockSize).toBe('90%');
  });

  it('hält den Tabulator im modalen Blatt', async () => {
    await render(WirtComponent);
    const erste = screen.getByRole('button', { name: 'erste' });
    const zweite = screen.getByRole('button', { name: 'zweite' });

    zweite.focus();
    await userEvent.tab();

    expect(document.activeElement).not.toBe(zweite);
    erste.focus();
    await userEvent.tab({ shift: true });

    expect(document.activeElement).not.toBe(erste);
  });

  it('lässt den Tabulator im nicht modalen Blatt laufen', async () => {
    const { container } = await render(SheetComponent, { inputs: { beschriftung: 'Steinpilz' } });
    const griff = screen.getByRole('button', { name: 'Blatt greifen' });
    griff.focus();

    await userEvent.tab();

    expect(container.querySelector('[aria-modal]')).toBeNull();
  });
});
