import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { PhotoPickerComponent } from './photo-picker.component';

@Component({
  imports: [PhotoPickerComponent],
  template: `<app-photo-picker [files]="files()" (filesChange)="files.set($event)" />`,
})
class HostComponent {
  readonly files = signal<readonly File[]>([]);
}

function shot(name: string): File {
  return new File(['bild'], name, { type: 'image/jpeg' });
}

/** Das versteckte Dateifeld hinter der Kachel „Foto hinzufügen“. */
function fieldOf(container: Element): HTMLInputElement {
  const field = container.querySelector('input[type=file]');
  if (!(field instanceof HTMLInputElement)) throw new Error('Das Dateifeld fehlt.');
  return field;
}

describe('FotoWahlComponent', () => {
  beforeEach(() => {
    // jsdom kennt keine Objekt-Adressen. Ohne Ersatz bliebe jede Vorschau leer.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (file: File) => `blob:${file.name}`,
      revokeObjectURL: () => undefined,
    });
  });

  it('nimmt bis zu drei Bilder an und zeigt sie als Vorschau', async () => {
    const { fixture, container } = await render(HostComponent);
    await userEvent.upload(fieldOf(container), [shot('eins.jpg'), shot('zwei.jpg')]);

    expect(fixture.componentInstance.files()).toHaveLength(2);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    await noViolations(container);
  });

  it('lässt höchstens drei zu und meldet den Rest', async () => {
    const { fixture, container } = await render(HostComponent);

    await userEvent.upload(fieldOf(container), [
      shot('eins.jpg'),
      shot('zwei.jpg'),
      shot('drei.jpg'),
      shot('vier.jpg'),
    ]);

    expect(fixture.componentInstance.files()).toHaveLength(3);
    expect(container.querySelector('input[type=file]')).toBeNull();
  });

  it('entfernt ein Bild wieder', async () => {
    const { fixture, container } = await render(HostComponent);
    await userEvent.upload(fieldOf(container), [shot('eins.jpg')]);

    await userEvent.click(screen.getByRole('button', { name: 'Foto 1 entfernen' }));

    expect(fixture.componentInstance.files()).toHaveLength(0);
  });

  it('meldet nichts, wenn die Wahl abgebrochen wurde', async () => {
    const { fixture, container } = await render(HostComponent);

    fieldOf(container).dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.files()).toHaveLength(0);
  });
});
