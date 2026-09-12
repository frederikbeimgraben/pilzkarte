import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComparisonCellComponent } from './comparison-cell.component';

/**
 * Eine Zeile der Gegenüberstellung: die Beschriftung und die Werte der Arten.
 *
 * `display: contents` hält die Zeile aus dem Raster heraus, damit Beschriftung
 * und Werte Kinder des Gitters bleiben und in ihren Spuren stehen. Für
 * Hilfsmittel gibt es sie trotzdem: ohne `role="row"` stünden die Zellen ohne
 * Zeile in der Tabelle.
 *
 * Die Tönung einer Zeile mit Unterschied vererbt sich als Eigenschaft an die
 * Zellen. Jede Zelle einzeln zu tönen hieße, dieselbe Aussage so oft zu
 * wiederholen, wie es Arten gibt.
 */
@Component({
  selector: 'app-comparison-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComparisonCellComponent],
  templateUrl: './comparison-row.component.html',
  styleUrl: './comparison-row.component.scss',
  host: {
    role: 'row',
    '[class.comparison__row--differs]': 'differs()',
  },
})
export class ComparisonRowComponent {
  readonly label = input.required<string>();
  /** Unterscheiden sich die Arten in dieser Zeile? Dann ist sie getönt. */
  readonly differs = input(false);
}
