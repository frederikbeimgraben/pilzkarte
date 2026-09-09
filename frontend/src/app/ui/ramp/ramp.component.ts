import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Der Farbverlauf der Wertkacheln. Er gehört zu den Daten, nicht zum Theme:
 * die Nachschlagetabelle des Renderings färbt die Kacheln genauso, in hell
 * wie in dunkel. Deshalb feste Farben und kein Token.
 */
export const VORHERSAGE_RAMPE: readonly string[] = [
  '#0d0827',
  '#361152',
  '#651a68',
  '#942864',
  '#c23b54',
  '#e55c3c',
  '#f88937',
  '#fcbb59',
  '#fce79b',
];

/** Legende einer Darstellung: Beschriftung, Farbverlauf, beide Enden. */
@Component({
  selector: 'app-ramp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ramp.component.html',
  styleUrl: './ramp.component.scss',
})
export class RampComponent {
  readonly beschriftung = input.required<string>();
  readonly von = input.required<string>();
  readonly bis = input.required<string>();
  readonly farben = input<readonly string[]>(VORHERSAGE_RAMPE);
}
