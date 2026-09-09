import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type PiktogrammName } from '../svg-icon/svg-icon.component';

/** Hell steht über der Karte, primär ist die Hauptaktion. */
export type SchwebeVariante = 'hell' | 'primaer';

/** Ein schwebender Knopf über der Karte: 48 px, Radius 14. */
@Component({
  selector: 'app-floating-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './floating-button.component.html',
  styleUrl: './floating-button.component.scss',
})
export class FloatingButtonComponent {
  readonly icon = input.required<PiktogrammName>();
  readonly beschriftung = input.required<string>();
  readonly variante = input<SchwebeVariante>('hell');

  readonly klick = output();
}
