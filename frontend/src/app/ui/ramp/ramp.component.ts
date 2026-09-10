import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FORECAST_RAMP } from './ramp-colors';

/** Legende einer Darstellung: Beschriftung, Farbverlauf, beide Enden. */
@Component({
  selector: 'app-ramp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ramp.component.html',
  styleUrl: './ramp.component.scss',
})
export class RampComponent {
  readonly label = input.required<string>();
  readonly von = input.required<string>();
  readonly bis = input.required<string>();
  readonly colors = input<readonly string[]>(FORECAST_RAMP);
}
