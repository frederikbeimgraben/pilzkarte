import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextNumber = 0;

/**
 * Eine Zeile mit einem Haken davor: links das Kästchen, rechts Titel und
 * Unterzeile. Sie steht in der Rechtematrix einer Rolle und bei den Rollen
 * einer Person.
 *
 * Das Kästchen ist ein echtes `input[type=checkbox]`, nur unsichtbar. So
 * bleiben Tastatur, Fokus und Vorleser die des Browsers; gezeichnet wird
 * daneben, nach den Maßen der Artboards.
 */
@Component({
  selector: 'app-check-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './check-row.component.html',
  styleUrl: './check-row.component.scss',
})
export class CheckRowComponent {
  readonly titel = input.required<string>();
  readonly subline = input<string>();
  readonly checked = input(false);
  /** Eine feste Rolle trägt jedes Recht und lässt es sich nicht abwählen. */
  readonly disabled = input(false);

  readonly toggled = output<boolean>();

  protected readonly boxId = `app-check-${nextNumber++}`;

  protected onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}
