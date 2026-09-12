import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Farbe } from '../../core/api/models';

/** Wo die harten Kanten liegen, wenn ein Körper mehrere Farben trägt. */
const ANGLE = 104;

/**
 * Eine Farbe als Fläche, ohne Rahmen.
 *
 * Ein Rahmen verfälschte die Farbe, darum hält eine feine Innenlinie Weiß und
 * Schwarz sichtbar. Mehrere Farben stehen mit harter Kante nebeneinander: ein
 * Verlauf behauptete Zwischentöne, die die Quelle nicht nennt.
 */
@Component({
  selector: 'app-colour-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './colour-field.component.html',
  styleUrl: './colour-field.component.scss',
})
export class ColourFieldComponent {
  readonly colours = input.required<readonly Farbe[]>();
  /** Die Namen zusammen, für Hilfsmittel. Sichtbar stehen sie links am Merkmal. */
  readonly label = input.required<string>();

  protected readonly fill = computed(() => paint(this.colours()));
}

/** Eine Farbe füllt die Fläche, mehrere teilen sie in gleiche Streifen. */
export function paint(colours: readonly Farbe[]): string {
  if (colours.length === 0) return 'transparent';
  if (colours.length === 1) return colours[0].hex;
  const share = 100 / colours.length;
  const stops = colours.map((colour, index) => `${colour.hex} ${index * share}% ${(index + 1) * share}%`);
  return `linear-gradient(${ANGLE}deg,${stops.join(',')})`;
}
