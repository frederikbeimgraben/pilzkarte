import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** `notiz` ist der kleine Fließtext, `unter` die Unterzeile einer Zeile. */
export type NoteVariant = 'notiz' | 'unter';

/** Erklärender Text in gedämpfter Farbe. */
@Component({
  selector: 'app-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './note.component.html',
  styleUrl: './note.component.scss',
})
export class NoteComponent {
  readonly variant = input<NoteVariant>('notiz');
  /** Kursiv, wie der lateinische Name einer Art. */
  readonly italic = input(false);
}
