import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Eine Plakette mit freier Farbe.
 *
 * Geometrie und Schrift sind die einer Marke des Kits. Nur die Farbe ist frei,
 * und die braucht sie: das Kit kennt fünf Rollen, und „giftig“ und „tödlich
 * giftig“ bekämen dieselbe. Ein Punkt stand hier einmal davor; er hatte die
 * Farbe der Schrift und sagte nichts, was die Farbe nicht schon sagt.
 *
 * Alle drei Zeilen der Einstufung tragen diesen Baustein: eine Bauform, drei
 * Farbrollen. Nebeneinander sahen Speisewert, Schutz und Handel sonst aus wie
 * drei verschiedene Dinge.
 */
@Component({
  selector: 'app-level-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-pill.component.html',
  styleUrl: './level-pill.component.scss',
})
export class LevelPillComponent {
  readonly text = input.required<string>();
  readonly colour = input.required<string>();
}
