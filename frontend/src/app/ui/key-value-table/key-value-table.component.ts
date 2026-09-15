import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Der Rahmen einer Merkmalstabelle. Die Zeilen kommen als Inhalt. */
@Component({
  selector: 'app-key-value-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--key-value-table-columns]': 'columns()' },
  templateUrl: './key-value-table.component.html',
  styleUrl: './key-value-table.component.scss',
})
export class KeyValueTableComponent {
  /** Wie viele Wertspalten die Zeilen tragen. Der Vergleich nennt eine je Art. */
  readonly columns = input(1);
}
