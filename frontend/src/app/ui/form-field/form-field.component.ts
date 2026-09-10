import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

let nextNumber = 0;

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
  imports: [SvgIconComponent],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly multiline = input(false);
  /**
   * Die Art des Feldes. `date` und `number` geben am Telefon die passende
   * Tastatur und den Datumswähler des Systems, statt beides nachzubauen.
   */
  readonly kind = input<'text' | 'number' | 'date'>('text');
  /** Ein Feld, das nur zeigt und beim Tippen eine Auswahl öffnet. */
  readonly readOnly = input(false);
  /** Ein Piktogramm vor der Eingabe, wie die Lupe im Suchfeld. */
  readonly icon = input<IconName>();
  /**
   * Versteckt die Beschriftung, ohne sie wegzulassen. Das Suchfeld der
   * Mockups trägt keine sichtbare Beschriftung, ein Screenreader braucht sie.
   */
  readonly hideLabel = input(false);

  readonly valueChange = output<string>();
  readonly displayClick = output();

  protected readonly fieldId = `app-feld-${nextNumber++}`;
  protected readonly empty = computed(() => this.value().length === 0);

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
