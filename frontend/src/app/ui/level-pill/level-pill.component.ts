import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Eine Stufe mit eigener Farbe: Punkt, dann das Wort.
 *
 * Die Farbe trägt die Warnung. Ein Badge des Kits kennt nur fünf Rollen und
 * müsste zwei Stufen dieselbe Farbe geben; „giftig“ und „tödlich giftig“ sind
 * dann nicht mehr zu unterscheiden.
 */
@Component({
  selector: 'app-level-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-pill.component.html',
  styleUrl: './level-pill.component.scss',
})
export class LevelPillComponent {
  readonly text = input.required<string>();
  readonly colour = input.required<string>();
}
