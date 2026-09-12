import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Die Gegenüberstellung mehrerer Arten: links die Beschriftung, rechts je Art
 * eine Spalte.
 *
 * Das Raster steht fest: eine Spur für die Beschriftung, dann für jede Art eine
 * gleich breite. Reihen aus Flex hatten sich nach der Textlänge ausgerichtet,
 * und die Werte zweier Arten standen dann nicht mehr untereinander.
 *
 * Die Zeilen kommen von außen, damit jede den Baustein zeigen kann, der zu
 * ihrem Merkmal gehört: ein Maß, eine Farbe, eine Verfärbung, ein Zeitraum.
 */
@Component({
  selector: 'app-comparison-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparison-table.component.html',
  styleUrl: './comparison-table.component.scss',
})
export class ComparisonTableComponent {
  private readonly i18n = inject(I18nService);

  /** Die Namen der Arten, einer je Spalte. */
  readonly columns = input.required<readonly string[]>();
  /** Der Name der Tabelle für Hilfsmittel. */
  readonly label = input.required<string>();

  /** Die erste Spur trägt die Beschriftungen. Leer bliebe sie namenlos. */
  protected headLabel(): string {
    return this.i18n.translate('vergleich.merkmal');
  }
}
