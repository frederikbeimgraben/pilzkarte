import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Eine wählbare Farbe für Zone oder Marker. */
export interface ColorSwatch {
  value: string;
  label: string;
}

/**
 * Die sechs Farben aus dem Artboard `Zone`. Der enge Typ ist kein Schmuck:
 * MapLibre und Terra Draw nehmen nur echte Hex-Werte an.
 */
export const OBJECT_COLORS: readonly `#${string}`[] = [
  '#004225',
  '#8c6820',
  '#185468',
  '#8c1c16',
  '#876010',
  '#3a3f3b',
];

/**
 * Die Farbwahl für ein Objekt auf der Karte. Rolle `radiogroup`, damit die
 * Pfeiltasten des Browsers die Wahl bedienen.
 */
@Component({
  selector: 'app-color-swatches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-swatches.component.html',
  styleUrl: './color-swatches.component.scss',
})
export class ColorSwatchesComponent {
  readonly colors = input.required<readonly ColorSwatch[]>();
  readonly value = input.required<string>();
  readonly label = input.required<string>();

  readonly valueChange = output<string>();
}
