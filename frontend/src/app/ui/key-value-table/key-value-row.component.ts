import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Eine Zeile der Merkmalstabelle. Der Wert kommt als Text oder, wenn er ein
 * Badge trägt, als Inhalt.
 */
@Component({
  selector: 'app-key-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './key-value-row.component.html',
  styleUrl: './key-value-row.component.scss',
})
export class KeyValueRowComponent {
  readonly schluessel = input.required<string>();
  readonly wert = input<string>();
}
