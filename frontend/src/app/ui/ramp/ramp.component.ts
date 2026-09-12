import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NoteComponent } from '../note/note.component';
import { FORECAST_RAMP } from './ramp-colors';

/** Legende einer Darstellung: Beschriftung, Farbverlauf, beide Enden. */
@Component({
  selector: 'app-ramp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoteComponent],
  templateUrl: './ramp.component.html',
  styleUrl: './ramp.component.scss',
})
export class RampComponent {
  readonly label = input.required<string>();
  readonly von = input.required<string>();
  readonly bis = input.required<string>();
  readonly colors = input<readonly string[]>(FORECAST_RAMP);
  /** Ein Satz unter der Skala, der sagt, wie fein sie überhaupt misst. */
  readonly note = input<string>();
}
