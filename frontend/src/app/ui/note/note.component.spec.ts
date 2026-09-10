import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { NoteComponent } from './note.component';

@Component({
  imports: [NoteComponent],
  template: `
    <app-note>Ohne Verbindung wird der Fund lokal gespeichert.</app-note>
    <app-note variant="unter">Weiterführend: Wikipedia.</app-note>
    <app-note variant="unter" [italic]="true">Boletus edulis · Röhrling</app-note>
  `,
})
class HostComponent {}

describe('NoteComponent', () => {
  it('zeigt beide Varianten', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Ohne Verbindung wird der Fund lokal gespeichert.')).toBeInTheDocument();
    expect(container.querySelectorAll('.note--subline')).toHaveLength(2);
    expect(screen.getByText('Boletus edulis · Röhrling')).toHaveClass('note--italic');
    await noViolations(container);
  });
});
