import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type PiktogrammName } from '../svg-icon/svg-icon.component';

/** Eine Zeile im Plus-Menü: Kachel mit Piktogramm, Titel und Unterzeile. */
@Component({
  selector: 'app-action-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './action-row.component.html',
  styleUrl: './action-row.component.scss',
})
export class ActionRowComponent {
  readonly icon = input.required<PiktogrammName>();
  readonly titel = input.required<string>();
  readonly unter = input<string>();

  readonly auswahl = output();
}
