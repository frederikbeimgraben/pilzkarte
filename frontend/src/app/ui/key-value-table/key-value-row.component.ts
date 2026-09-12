import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Eine Zeile der Merkmalstabelle. Der Wert kommt als Text oder, wenn er ein
 * Badge trägt, als Inhalt.
 *
 * Unter dem Schlüssel steht Platz für ein Wort, das den Wert benennt: die
 * Farbe heißt „hell bis dunkelbraun“, gezeigt wird sie rechts als Fläche.
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
  readonly value = input<string>();
  /**
   * Führt der Schlüssel weiter, steht er als Verweis. Die Verwechslungstabelle
   * zeigt damit auf das Profil des Partners.
   */
  readonly keyRoute = input<string | null>(null);
  /** Die Unterzeile am Schlüssel. Sie nennt, was rechts als Wert steht. */
  readonly unter = input<string | null>(null);
  /**
   * Ein Wert endet rechts, ein Satz beginnt links.
   *
   * Werte fluchten an der rechten Kante mit den Farbflächen daneben. Fließtext
   * nicht: die Merkmalszeile „Hut“ ist vier Zeilen lang, und ein
   * rechtsbündiger Absatz franst links aus.
   */
  readonly flow = input(false);
}
