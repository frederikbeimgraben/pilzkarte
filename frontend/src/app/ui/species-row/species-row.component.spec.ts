import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SpeciesRowComponent } from './species-row.component';

@Component({
  imports: [SpeciesRowComponent],
  template: `
    <app-species-row name="Steinpilz" latin="Boletus edulis" [active]="true">
      <span curve>Kurve</span>
      <span tags>Vorhersage</span>
    </app-species-row>
  `,
})
class HostComponent {}

describe('SpeciesRowComponent', () => {
  it('zeigt Name, lateinischen Namen, Kurve und Tags', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
    expect(screen.getByText('Kurve')).toBeInTheDocument();
    expect(screen.getByText('Vorhersage')).toBeInTheDocument();
    expect(container.querySelector('.speciesrow--active')).not.toBeNull();
    await noViolations(container);
  });

  it('markiert die aktive Art für Auge und Hilfsmittel', async () => {
    await render(HostComponent);

    const button = screen.getByRole('button', { name: /Steinpilz/ });
    expect(button).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('nimmt den Fokus auf Zuruf an, damit Pfeiltasten durch die Liste wandern', async () => {
    const { fixture } = await render(SpeciesRowComponent, {
      inputs: { name: 'Birkenpilz', latin: 'Leccinum scabrum' },
    });

    fixture.componentInstance.focus();

    expect(screen.getByRole('button', { name: /Birkenpilz/ })).toHaveFocus();
  });

  it('meldet die gewählte Art', async () => {
    const { fixture } = await render(SpeciesRowComponent, {
      inputs: { name: 'Pfifferling', latin: 'Cantharellus cibarius' },
    });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: /Pfifferling/ }));

    expect(calls).toBe(1);
  });
});
