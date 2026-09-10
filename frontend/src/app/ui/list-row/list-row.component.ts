import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Eine Zeile in einer Liste: vorn ein Zeichen, in der Mitte Titel, Unterzeile
 * und Notiz, rechts ein Wert oder ein Badge. Anklickbare Zeilen werden zu
 * Schaltflächen, damit sie über die Tastatur erreichbar sind.
 */
@Component({
  selector: 'app-list-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './list-row.component.html',
  styleUrl: './list-row.component.scss',
})
export class ListRowComponent {
  readonly titel = input.required<string>();
  readonly subline = input<string>();
  readonly notiz = input<string>();
  readonly value = input<string>();
  readonly clickable = input(false);
  /** Eine Zeile, die eine Wahl trägt, meldet sich als gedrückt. */
  readonly selected = input(false);

  readonly chosen = output();
}
