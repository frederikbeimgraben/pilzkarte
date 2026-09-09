import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die Marken auf der Grundlinie stehen am Anfang der Monate Jan, Mär, … Nov. */
const MONATSMARKEN = [0, 9, 18, 27, 36, 44] as const;

/** Der Anteil des stärksten Wertes, unter dem eine Woche als dünn gilt. */
const DUENN_UNTER = 0.25;

let naechsteNummer = 0;

/** Ein Streifen über einer Woche, die auf wenigen Begehungen ruht. */
interface Streifen {
  x: number;
  breite: number;
}

interface Zeichnung {
  breite: number;
  hoehe: number;
  alleJahre: string;
  laufendFlaeche: string;
  laufendLinie: string;
  hatLaufend: boolean;
  marken: number[];
  endeX: number;
  endeY: number;
  punktRadius: number;
  duenn: Streifen[];
}

/**
 * Die Saisonkurve einer Art: der Anteil der Begehungen mit Fund je
 * Kalenderwoche. Alle Jahre liegen schwach als Fläche darunter, das laufende
 * Jahr als Linie bis zur letzten vollen Woche. Beide Reihen teilen sich einen
 * Höchstwert, sonst ragte die eine über den Rand.
 *
 * Sind die Begehungen je Woche bekannt, verblassen die Wochen, die auf wenigen
 * Begehungen ruhen. Ohne diese Zahlen sähe eine Woche mit drei Begehungen aus
 * wie eine mit dreihundert.
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
  /** Die Monatsnamen unter der Grundlinie, gleichmäßig verteilt. */
  readonly monate = input<readonly string[]>([]);
  readonly legendeLaufend = input<string>();
  readonly legendeJahre = input<string>();
  /** Der Nenner der Fläche: Begehungen je Kalenderwoche über alle Jahre. */
  readonly begehungenAlleJahre = input<readonly number[]>([]);
  /** Der Nenner der Linie: Begehungen je Kalenderwoche im laufenden Jahr. */
  readonly begehungenLaufendesJahr = input<readonly number[]>([]);

  protected readonly maskeId = `funke-dicht-${naechsteNummer++}`;
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
      hatLaufend: laufendP.length > 0,
      marken: MONATSMARKEN.map((k) => (k / 51) * breite),
      endeX: letzte[0],
      endeY: letzte[1],
      punktRadius: gross ? 3 : 2,
      duenn: this.duenneWochen(breite),
    };
  }

  /**
   * Die Wochen, in denen wenigstens eine der beiden Reihen auf wenigen
   * Begehungen ruht. Jede Reihe misst sich an ihrer eigenen stärksten Woche,
   * weil das laufende Jahr naturgemäß weniger Begehungen trägt als zehn Jahre.
   */
  private duenneWochen(breite: number): Streifen[] {
    const reihen = [this.begehungenAlleJahre(), this.begehungenLaufendesJahr()].filter(
      (reihe) => reihe.length > 0,
    );
    if (reihen.length === 0) return [];
    const schwellen = reihen.map((reihe) => Math.max(...reihe) * DUENN_UNTER);
    const schritt = breite / 51;
    const streifen: Streifen[] = [];
    for (let i = 0; i < Math.max(...reihen.map((reihe) => reihe.length)); i++) {
      const duenn = reihen.some((reihe, r) => i < reihe.length && reihe[i] < schwellen[r]);
      if (!duenn) continue;
      const x = Math.max(0, (i - 0.5) * schritt);
      streifen.push({ x, breite: Math.min(breite, (i + 0.5) * schritt) - x });
    }
    return streifen;
  }
}
