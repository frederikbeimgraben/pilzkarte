import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { KeyValueRowComponent } from './key-value-row.component';
import { KeyValueTableComponent } from './key-value-table.component';

@Component({
  imports: [KeyValueTableComponent, KeyValueRowComponent],
  template: `
    <app-key-value-table>
      <app-key-value-row schluessel="Hut" wert="6 bis 25 cm" />
      <app-key-value-row schluessel="Speisewert"><span>Speisepilz</span></app-key-value-row>
    </app-key-value-table>
  `,
})
class WirtComponent {}

describe('KeyValueTableComponent', () => {
  it('zeigt Schlüssel und Wert je Zeile', async () => {
    const { container } = await render(WirtComponent);

    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('6 bis 25 cm')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('nimmt einen reichen Wert als Inhalt an', async () => {
    await render(WirtComponent);

    expect(screen.getByText('Speisepilz')).toBeInTheDocument();
  });
});
