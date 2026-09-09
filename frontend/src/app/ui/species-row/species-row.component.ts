import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Eine Zeile der Artenliste: Name und lateinischer Name links, die Saisonkurve
 * rechts, die Tags darunter. Kurve und Tags kommen als Inhalt, damit die Zeile
 * weder Kurvendaten noch Badge-Varianten kennen muss.
 */
@Component({
  selector: 'app-species-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './species-row.component.html',
  styleUrl: './species-row.component.scss',
})
export class SpeciesRowComponent {
  readonly name = input.required<string>();
  readonly latein = input.required<string>();
  readonly aktiv = input(false);

  readonly auswahl = output();
}
