import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { FotoWahlComponent } from './foto-wahl.component';

@Component({
  imports: [FotoWahlComponent],
  template: `<app-foto-wahl [dateien]="dateien()" (dateienChange)="dateien.set($event)" />`,
})
class WirtComponent {
  readonly dateien = signal<readonly File[]>([]);
}

function bild(name: string): File {
  return new File(['bild'], name, { type: 'image/jpeg' });
}

/** Das versteckte Dateifeld hinter der Kachel „Foto hinzufügen“. */
function feldVon(container: Element): HTMLInputElement {
  const feld = container.querySelector('input[type=file]');
  if (!(feld instanceof HTMLInputElement)) throw new Error('Das Dateifeld fehlt.');
  return feld;
}

describe('FotoWahlComponent', () => {
  beforeEach(() => {
    // jsdom kennt keine Objekt-Adressen. Ohne Ersatz bliebe jede Vorschau leer.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (datei: File) => `blob:${datei.name}`,
      revokeObjectURL: () => undefined,
    });
  });

  it('nimmt bis zu drei Bilder an und zeigt sie als Vorschau', async () => {
    const { fixture, container } = await render(WirtComponent);
    await userEvent.upload(feldVon(container), [bild('eins.jpg'), bild('zwei.jpg')]);

    expect(fixture.componentInstance.dateien()).toHaveLength(2);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    await keineVerstoesse(container);
  });

  it('lässt höchstens drei zu und meldet den Rest', async () => {
    const { fixture, container } = await render(WirtComponent);

    await userEvent.upload(feldVon(container), [
      bild('eins.jpg'),
      bild('zwei.jpg'),
      bild('drei.jpg'),
      bild('vier.jpg'),
    ]);

    expect(fixture.componentInstance.dateien()).toHaveLength(3);
    expect(container.querySelector('input[type=file]')).toBeNull();
  });

  it('entfernt ein Bild wieder', async () => {
    const { fixture, container } = await render(WirtComponent);
    await userEvent.upload(feldVon(container), [bild('eins.jpg')]);

    await userEvent.click(screen.getByRole('button', { name: 'Foto 1 entfernen' }));

    expect(fixture.componentInstance.dateien()).toHaveLength(0);
  });

  it('meldet nichts, wenn die Wahl abgebrochen wurde', async () => {
    const { fixture, container } = await render(WirtComponent);

    feldVon(container).dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.dateien()).toHaveLength(0);
  });
});
