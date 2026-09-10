import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VORHERSAGE_RAMPE } from './rampe-farben';

/** Legende einer Darstellung: Beschriftung, Farbverlauf, beide Enden. */
@Component({
  selector: 'app-ramp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ramp.component.html',
  styleUrl: './ramp.component.scss',
})
export class RampComponent {
  readonly beschriftung = input.required<string>();
  readonly von = input.required<string>();
  readonly bis = input.required<string>();
  readonly farben = input<readonly string[]>(VORHERSAGE_RAMPE);
}
