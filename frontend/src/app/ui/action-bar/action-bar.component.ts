import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { NoteComponent } from '../note/note.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/**
 * Die Aktionsleiste am unteren Rand eines Blatts oder einer Objektseite.
 * Oben die Hauptaktion in voller Breite, darunter zwei gleich breite
 * Nebenaktionen, ganz unten ein Geist-Knopf. Die Knöpfe kommen aus dem
 * ui-kit; hier steht nur die Anordnung.
 */
@Component({
  selector: 'app-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, NoteComponent, SvgIconComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
})
export class ActionBarComponent {
  readonly primary = input<string>();
  readonly mainIcon = input<IconName>();
  readonly mainDisabled = input(false);
  /** Steht die Hauptaktion nicht offen, sagt diese Zeile darunter, warum. */
  readonly subline = input<string>();
  readonly secondary = input<string>();
  /** Die linke der beiden Nebenaktionen, wenn keine Gefahr im Spiel ist. */
  readonly second = input<string>();
  readonly danger = input<string>();
  readonly ghost = input<string>();

  readonly mainClick = output();
  readonly secondaryClick = output();
  readonly secondClick = output();
  readonly dangerClick = output();
  readonly ghostClick = output();
}
