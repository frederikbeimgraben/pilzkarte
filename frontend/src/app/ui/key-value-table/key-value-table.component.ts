import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Der Rahmen einer Merkmalstabelle. Die Zeilen kommen als Inhalt. */
@Component({
  selector: 'app-key-value-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './key-value-table.component.html',
  styleUrl: './key-value-table.component.scss',
})
export class KeyValueTableComponent {}
