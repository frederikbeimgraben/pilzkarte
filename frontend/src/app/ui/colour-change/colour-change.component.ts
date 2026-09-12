import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Farbe } from '../../core/api/models';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';
import { ColourFieldComponent } from '../colour-field/colour-field.component';

/**
 * Eine Verfärbung: von, Pfeil, nach — und darunter die Dauer.
 *
 * Der Pfeil erscheint erst, wenn es zwei Farben gibt. Nennt die Quelle keine
 * Ausgangsfarbe, stünde er vor der einzigen Fläche und sähe aus wie ein
 * Zeichen, dem etwas fehlt.
 *
 * Die Dauer stand einmal rechts daneben und schob die Fläche aus der Flucht
 * der Farbzeilen darüber. Sie steht jetzt darunter.
 */
@Component({
  selector: 'app-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, SvgIconComponent],
  templateUrl: './colour-change.component.html',
  styleUrl: './colour-change.component.scss',
  host: { '[class.colour-change--small]': 'small()' },
})
export class ColourChangeComponent {
  readonly from = input.required<readonly Farbe[]>();
  readonly to = input.required<readonly Farbe[]>();
  readonly fromLabel = input.required<string>();
  readonly toLabel = input.required<string>();
  /** „sofort“, „langsam“ oder „bleibt“ — der Text kommt aus dem Katalog. */
  readonly duration = input.required<string>();
  readonly arrowLabel = input.required<string>();

  /** Kleiner für die Gegenüberstellung, wo zwei Arten nebeneinander stehen. */
  readonly small = input(false);

  /** Zwei Farben, also ein Weg von der einen zur anderen. */
  protected readonly changes = computed(() => this.from().length > 0 && this.to().length > 0);

  protected readonly arrowSize = computed(() => (this.small() ? 12 : 14));
  protected readonly hourglassSize = computed(() => (this.small() ? 12 : 15));
}
