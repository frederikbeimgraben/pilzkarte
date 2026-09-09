import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { SpeciesRowComponent } from './species-row.component';

@Component({
  imports: [SpeciesRowComponent],
  template: `
    <app-species-row name="Steinpilz" latein="Boletus edulis" [aktiv]="true">
      <span kurve>Kurve</span>
      <span tags>Vorhersage</span>
    </app-species-row>
  `,
})
class WirtComponent {}

describe('SpeciesRowComponent', () => {
  it('zeigt Name, lateinischen Namen, Kurve und Tags', async () => {
    const { container } = await render(WirtComponent);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
    expect(screen.getByText('Kurve')).toBeInTheDocument();
    expect(screen.getByText('Vorhersage')).toBeInTheDocument();
    expect(container.querySelector('.artzeile--aktiv')).not.toBeNull();
    await keineVerstoesse(container);
  });

  it('meldet die gewählte Art', async () => {
    const { fixture } = await render(SpeciesRowComponent, {
      inputs: { name: 'Pfifferling', latein: 'Cantharellus cibarius' },
    });
    let gerufen = 0;
    fixture.componentInstance.auswahl.subscribe(() => (gerufen += 1));

    await userEvent.click(screen.getByRole('button', { name: /Pfifferling/ }));

    expect(gerufen).toBe(1);
  });
});
