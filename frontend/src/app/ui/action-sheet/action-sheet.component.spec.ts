import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { ActionRowComponent } from './action-row.component';
import { ActionSheetComponent } from './action-sheet.component';

@Component({
  imports: [ActionSheetComponent, ActionRowComponent],
  template: `
    <app-action-sheet titel="Eintragen">
      <app-action-row icon="funde" titel="Fund melden" unter="Art, Ort, Datum, Fotos" />
      <app-action-row icon="zone" titel="Zone zeichnen" />
    </app-action-sheet>
  `,
})
class WirtComponent {}

describe('ActionSheetComponent', () => {
  it('zeigt den Titel und jede Aktionszeile', async () => {
    const { container } = await render(WirtComponent);

    expect(screen.getByRole('heading', { name: 'Eintragen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fund melden/ })).toBeInTheDocument();
    expect(screen.getByText('Art, Ort, Datum, Fotos')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('meldet die gewählte Zeile', async () => {
    const { fixture } = await render(ActionRowComponent, {
      inputs: { icon: 'ort', titel: 'Marker setzen' },
    });
    let gerufen = 0;
    fixture.componentInstance.auswahl.subscribe(() => (gerufen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Marker setzen' }));

    expect(gerufen).toBe(1);
  });
});
