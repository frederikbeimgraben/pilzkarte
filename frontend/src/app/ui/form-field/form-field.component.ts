import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

let naechsteNummer = 0;

/**
 * Ein Feld im Formular: Beschriftung und darunter der Kasten. Zeigt das Feld
 * nur einen Wert an (Art, Datum, Ort), ist der Kasten eine Schaltfläche, die
 * die Auswahl öffnet; sonst wird getippt.
 *
 * Das ui-kit bringt ein eigenes Textfeld mit, aber mit eigener Beschriftung
 * und eigener Höhe. Die Mockups sind abgenommen und geben beides anders vor,
 * darum dieses Feld.
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly wert = input<string>('');
  readonly platzhalter = input<string>('');
  readonly mehrzeilig = input(false);
  /** Ein Feld, das nur zeigt und beim Tippen eine Auswahl öffnet. */
  readonly nurAnzeige = input(false);

  readonly wertChange = output<string>();
  readonly anzeigeKlick = output();

  protected readonly feldId = `app-feld-${naechsteNummer++}`;
  protected readonly leer = computed(() => this.wert().length === 0);

  protected beiEingabe(ereignis: Event): void {
    this.wertChange.emit((ereignis.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
