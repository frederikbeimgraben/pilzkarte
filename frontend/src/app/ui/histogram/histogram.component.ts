import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Balken {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  drin: boolean;
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
  readonly beschriftung = input.required<string>();
  /** Untere und obere Grenze der Bedingung, je 0 bis 1. */
  readonly von = input(0);
  readonly bis = input(1);

  protected readonly breite = 326;
  protected readonly hoehe = 64;

  protected readonly balken = computed<Balken[]>(() => {
    const anteile = this.anteile();
    const anzahl = anteile.length || 1;
    const top = Math.max(...anteile, Number.EPSILON);
    const schritt = this.breite / anzahl;
    return anteile.map((wert, i) => {
      const hoehe = (wert / top) * (this.hoehe - 4);
      const lage = i / anzahl;
      return {
        x: lage * this.breite,
        y: this.hoehe - hoehe,
        breite: Math.max(schritt - 1.5, 0.5),
        hoehe,
        drin: lage >= this.von() && lage <= this.bis(),
      };
    });
  });
}
