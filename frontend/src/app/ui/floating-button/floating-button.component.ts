import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Hell steht über der Karte, primär ist die Hauptaktion. */
export type FloatingVariant = 'hell' | 'primaer';

/** Ein schwebender Knopf über der Karte: 48 px, Radius 14. */
@Component({
  selector: 'app-floating-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './floating-button.component.html',
  styleUrl: './floating-button.component.scss',
})
export class FloatingButtonComponent {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly variant = input<FloatingVariant>('hell');
  /** Ein Knopf ohne Wirkung bleibt sichtbar, aber gesperrt. */
  readonly disabled = input(false);

  readonly pressed = output();
}
