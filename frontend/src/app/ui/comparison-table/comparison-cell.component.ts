import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Beschriftung oder Wert. Die Beschriftung steht links und trägt kein Gewicht. */
export type ComparisonCellVariant = 'beschriftung' | 'wert';

/** Eine Zelle der Gegenüberstellung. Die Tönung kommt von ihrer Zeile. */
@Component({
  selector: 'app-comparison-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparison-cell.component.html',
  styleUrl: './comparison-cell.component.scss',
  host: {
    role: 'cell',
    '[class.comparison__cell--label]': "variant() === 'beschriftung'",
  },
})
export class ComparisonCellComponent {
  readonly variant = input<ComparisonCellVariant>('wert');
}
