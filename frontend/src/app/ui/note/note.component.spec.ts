import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { NoteComponent } from './note.component';

@Component({
  imports: [NoteComponent],
  template: `
    <app-note>Ohne Verbindung wird der Fund lokal gespeichert.</app-note>
    <app-note variante="unter">Weiterführend: Wikipedia.</app-note>
    <app-note variante="unter" [kursiv]="true">Boletus edulis · Röhrling</app-note>
  `,
})
class WirtComponent {}

describe('NoteComponent', () => {
  it('zeigt beide Varianten', async () => {
    const { container } = await render(WirtComponent);

    expect(screen.getByText('Ohne Verbindung wird der Fund lokal gespeichert.')).toBeInTheDocument();
    expect(container.querySelectorAll('.notiz--unter')).toHaveLength(2);
    expect(screen.getByText('Boletus edulis · Röhrling')).toHaveClass('notiz--kursiv');
    await keineVerstoesse(container);
  });
});
