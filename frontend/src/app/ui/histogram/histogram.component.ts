import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Bar {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  inside: boolean;
}

/**
 * Die Verteilung einer Ebene über Deutschland, 40 Klassen. Klassen innerhalb
 * der gewählten Bedingung stehen in Primärfarbe, die übrigen in Randfarbe.
 * Die Anteile kommen vorgerechnet aus dem Manifest.
 */
@Component({
  selector: 'app-histogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './histogram.component.html',
  styleUrl: './histogram.component.scss',
})
export class HistogramComponent {
  readonly anteile = input.required<readonly number[]>();
  readonly label = input.required<string>();
  /** Untere und obere Grenze der Bedingung, je 0 bis 1. */
  readonly von = input(0);
  readonly bis = input(1);

  protected readonly breite = 326;
  protected readonly hoehe = 64;

  protected readonly bars = computed<Bar[]>(() => {
    const anteile = this.anteile();
    const anzahl = anteile.length || 1;
    const top = Math.max(...anteile, Number.EPSILON);
    const step = this.breite / anzahl;
    return anteile.map((value, i) => {
      const hoehe = (value / top) * (this.hoehe - 4);
      const position = i / anzahl;
      return {
        x: position * this.breite,
        y: this.hoehe - hoehe,
        breite: Math.max(step - 1.5, 0.5),
        hoehe,
        inside: position >= this.von() && position <= this.bis(),
      };
    });
  });
}
