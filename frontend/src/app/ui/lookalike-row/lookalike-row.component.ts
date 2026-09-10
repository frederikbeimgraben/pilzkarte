import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Eine Zeile der Verwechslungstabelle: Name, was ihn vom Original trennt, und
 * darunter die Marke für die Essbarkeit.
 *
 * Die Marke steht immer in einer eigenen Zeile und nie im Textfluss. Hing sie
 * hinter dem letzten Wort, sprang sie je nach Textlänge mal in dieselbe und mal
 * in die nächste Zeile, und der Abstand darüber wechselte von Zeile zu Zeile.
 */
@Component({
  selector: 'app-lookalike-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './lookalike-row.component.html',
  styleUrl: './lookalike-row.component.scss',
})
export class LookalikeRowComponent {
  readonly name = input.required<string>();
  readonly difference = input.required<string>();
  /** Der lateinische Name, wenn die Antwort ihn trägt. */
  readonly latin = input<string | null>(null);
  /** Das eigene Profil des Partners. Ohne Ziel bleibt der Name Text. */
  readonly route = input<string | null>(null);
}
