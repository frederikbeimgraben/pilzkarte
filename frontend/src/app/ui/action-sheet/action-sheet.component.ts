import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Das Plus-Menü: eine Überschrift und darunter die Aktionszeilen. */
@Component({
  selector: 'app-action-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-sheet.component.html',
  styleUrl: './action-sheet.component.scss',
})
export class ActionSheetComponent {
  readonly titel = input.required<string>();
}
