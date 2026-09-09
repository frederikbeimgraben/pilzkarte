import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Ein Filter-Chip. */
export interface Chip {
  wert: string;
  label: string;
}

/**
 * Die waagerechte Chip-Reihe über Listen. Genau ein Chip ist gewählt; ein
 * Tipp auf den gewählten Chip lässt ihn gewählt, damit die Liste nie ohne
 * Filter dasteht.
 */
@Component({
  selector: 'app-chip-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chip-group.component.html',
  styleUrl: './chip-group.component.scss',
})
export class ChipGroupComponent {
  readonly chips = input.required<readonly Chip[]>();
  readonly wert = input.required<string>();
  readonly beschriftung = input.required<string>();

  readonly wertChange = output<string>();
}
