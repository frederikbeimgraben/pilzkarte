import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Das Fadenkreuz auf der Karte. Es trägt eine Beschriftung, weil es die
 * einzige Anzeige des gewählten Orts ist.
 */
@Component({
  selector: 'app-crosshair',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crosshair.component.html',
  styleUrl: './crosshair.component.scss',
})
export class CrosshairComponent {
  readonly beschriftung = input.required<string>();
}
