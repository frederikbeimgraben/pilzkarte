import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Farbe } from '../../core/api/models';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';
import { ColourFieldComponent } from '../colour-field/colour-field.component';

/**
 * Eine Verfärbung: von, Pfeil, nach, dahinter die Dauer.
 *
 * Bleibt die Farbe, steht nur eine Fläche und das Wort dazu. Der Pfeil
 * erscheint erst, wenn sich wirklich etwas ändert.
 */
@Component({
  selector: 'app-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, SvgIconComponent],
  templateUrl: './colour-change.component.html',
  styleUrl: './colour-change.component.scss',
})
export class ColourChangeComponent {
  readonly from = input.required<readonly Farbe[]>();
  readonly to = input.required<readonly Farbe[]>();
  readonly fromLabel = input.required<string>();
  readonly toLabel = input.required<string>();
  /** „sofort“, „langsam“ oder „bleibt“ — der Text kommt aus dem Katalog. */
  readonly duration = input.required<string>();
  readonly arrowLabel = input.required<string>();

  protected readonly changes = computed(() => this.to().length > 0);
}
