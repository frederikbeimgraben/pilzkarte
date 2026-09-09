import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die Marken auf der Grundlinie stehen am Anfang der Monate Jan, Mär, … Nov. */
const MONATSMARKEN = [0, 9, 18, 27, 36, 44] as const;

interface Zeichnung {
  breite: number;
  hoehe: number;
  alleJahre: string;
  laufendFlaeche: string;
  laufendLinie: string;
  marken: number[];
  endeX: number;
  endeY: number;
  punktRadius: number;
}

/**
 * Die Saisonkurve einer Art: der Anteil der Begehungen mit Fund je
 * Kalenderwoche. Alle Jahre liegen schwach als Fläche darunter, das laufende
 * Jahr als Linie bis zur letzten vollen Woche. Beide Reihen teilen sich einen
 * Höchstwert, sonst ragte die eine über den Rand.
 */
@Component({
  selector: 'app-season-curve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-curve.component.html',
  styleUrl: './season-curve.component.scss',
})
export class SeasonCurveComponent {
  readonly alleJahre = input.required<readonly number[]>();
  readonly laufendesJahr = input.required<readonly number[]>();
  readonly beschriftung = input.required<string>();
  readonly gross = input(false);
  /** Der Höchstwert der Achse, oben links in die Kurve geschrieben. */
  readonly achse = input<string>();
  readonly legendeLaufend = input<string>();
  readonly legendeJahre = input<string>();

  protected readonly zeichnung = computed<Zeichnung>(() => this.rechne());

  private rechne(): Zeichnung {
    const gross = this.gross();
    const breite = gross ? 330 : 88;
    const hoehe = gross ? 72 : 36;
    const alle = this.alleJahre();
    const laufend = this.laufendesJahr();
    // Ohne Daten bleibt nur die Grundlinie; ein Höchstwert von 0 teilte durch null.
    const top = Math.max(...alle, ...laufend, Number.EPSILON);
    const punkt = (i: number, wert: number): [number, number] => [
      (i / 51) * breite,
      hoehe - 3 - (wert / top) * (hoehe - 8),
    ];
    const alleP = alle.map((wert, i) => punkt(i, wert));
    const laufendP = laufend.map((wert, i) => punkt(i, wert));
    const letzte = laufendP.at(-1) ?? [0, hoehe];
    return {
      breite,
      hoehe,
      alleJahre: `M0,${hoehe} ${alleP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${breite},${hoehe} Z`,
      laufendFlaeche: `M0,${hoehe} ${laufendP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${letzte[0].toFixed(1)},${hoehe} Z`,
      laufendLinie: `M${laufendP.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`,
      marken: MONATSMARKEN.map((k) => (k / 51) * breite),
      endeX: letzte[0],
      endeY: letzte[1],
      punktRadius: gross ? 3 : 2,
    };
  }
}
