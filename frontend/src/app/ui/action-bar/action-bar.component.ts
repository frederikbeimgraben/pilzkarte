import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { SvgIconComponent, type PiktogrammName } from '../svg-icon/svg-icon.component';

/**
 * Die Aktionsleiste am unteren Rand eines Blatts oder einer Objektseite.
 * Oben die Hauptaktion in voller Breite, darunter zwei gleich breite
 * Nebenaktionen, ganz unten ein Geist-Knopf. Die Knöpfe kommen aus dem
 * ui-kit; hier steht nur die Anordnung.
 */
@Component({
  selector: 'app-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SvgIconComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
})
export class ActionBarComponent {
  readonly haupt = input<string>();
  readonly hauptIcon = input<PiktogrammName>();
  readonly sekundaer = input<string>();
  /** Die linke der beiden Nebenaktionen, wenn keine Gefahr im Spiel ist. */
  readonly zweite = input<string>();
  readonly gefahr = input<string>();
  readonly geist = input<string>();

  readonly hauptKlick = output();
  readonly sekundaerKlick = output();
  readonly zweiteKlick = output();
  readonly gefahrKlick = output();
  readonly geistKlick = output();
}
