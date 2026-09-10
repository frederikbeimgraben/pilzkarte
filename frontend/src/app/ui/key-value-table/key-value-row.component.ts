import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Eine Zeile der Merkmalstabelle. Der Wert kommt als Text oder, wenn er ein
 * Badge trägt, als Inhalt.
 */
@Component({
  selector: 'app-key-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './key-value-row.component.html',
  styleUrl: './key-value-row.component.scss',
})
export class KeyValueRowComponent {
  readonly schluessel = input.required<string>();
  readonly wert = input<string>();
  /**
   * Führt der Schlüssel weiter, steht er als Verweis. Die Verwechslungstabelle
   * zeigt damit auf das Profil des Partners.
   */
  readonly keyRoute = input<string | null>(null);
}
