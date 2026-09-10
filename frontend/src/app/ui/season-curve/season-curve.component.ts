import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die Marken auf der Grundlinie stehen am Anfang der Monate Jan, Mär, … Nov. */
const MONTH_MARKS = [0, 9, 18, 27, 36, 44] as const;

/** Der Anteil des stärksten Wertes, unter dem eine Woche als dünn gilt. */
const THIN_BELOW = 0.25;

/**
 * Zentriertes gleitendes Mittel. Am Rand zählen die Nachbarn, die es gibt,
 * sonst zöge eine gedachte Null die erste und die letzte Woche nach unten.
 */
export function smooth(series: readonly number[], windowSize: number): readonly number[] {
  if (windowSize <= 1) return series;
  const half = Math.floor(windowSize / 2);
  return series.map((_, i) => {
    const von = Math.max(0, i - half);
    const bis = Math.min(series.length - 1, i + half);
    let sum = 0;
    for (let k = von; k <= bis; k++) sum += series[k];
    return sum / (bis - von + 1);
  });
}

let nextNumber = 0;

/** Ein Streifen über einer Woche, die auf wenigen Begehungen ruht. */
interface Strip {
  x: number;
  breite: number;
}

/** Eine Monatsmarke unter der Kurve: der Name und die Woche, in der er beginnt. */
export interface MonthMark {
  text: string;
  woche: number;
}

/** Eine gesetzte Monatsmarke: Anteil der Breite, auf dem sie sitzt. */
interface PlacedMark {
  text: string;
  links: number;
}

interface Drawing {
  breite: number;
  hoehe: number;
  alleJahre: string;
  currentArea: string;
  currentLine: string;
  hasCurrent: boolean;
  badges: number[];
  /** Der Endpunkt als Anteil der Fläche, in Prozent. Er steht neben dem SVG,
   * weil die verzerrte Zeichenfläche aus einem Kreis eine Ellipse machte. */
  endLeft: number;
  endTop: number;
  thin: Strip[];
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
 *
 * Die Zeichenfläche folgt der Breite des Wirts, damit die Kurve nie schmal in
 * der Mitte steht, während die Marken darunter über die ganze Breite laufen.
 * Was dabei nicht verzerren darf — die Zahl an der Achse und der Endpunkt —
 * steht neben dem SVG und nicht darin.
 *
 * Gezeichnet wird ein gleitendes Mittel über drei Wochen. Eine Woche mehr oder
 * weniger ist Zufall des Meldeverhaltens, nicht der Saison. Die Achse behält
 * den Höchstwert der Rohdaten, damit die Zahl neben der Kurve dieselbe ist wie
 * in der Liste.
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
  readonly label = input.required<string>();
  readonly large = input(false);
  /** Der Höchstwert der Achse, oben links in die Kurve geschrieben. */
  readonly axis = input<string>();
  /** Die Monatsnamen unter der Grundlinie, jeder auf seiner Woche. */
  readonly months = input<readonly MonthMark[]>([]);
  readonly legendCurrent = input<string>();
  readonly legendYears = input<string>();
  /** Der Nenner der Fläche: Begehungen je Kalenderwoche über alle Jahre. */
  readonly visitsAllYears = input<readonly number[]>([]);
  /** Der Nenner der Linie: Begehungen je Kalenderwoche im laufenden Jahr. */
  readonly visitsCurrentYearSeries = input<readonly number[]>([]);
  /** Breite des gleitenden Mittels in Wochen. 1 zeichnet die Rohwerte. */
  readonly smoothing = input(3);

  protected readonly maskId = `funke-dicht-${nextNumber++}`;
  protected readonly drawing = computed<Drawing>(() => this.compute());

  private compute(): Drawing {
    const large = this.large();
    const breite = large ? 330 : 88;
    const hoehe = large ? 72 : 36;
    const windowSize = this.smoothing();
    const alle = smooth(this.alleJahre(), windowSize);
    const current = smooth(this.laufendesJahr(), windowSize);
    // Der Höchstwert kommt aus den Rohdaten, nicht aus der geglätteten Reihe.
    // Sonst stiege die Kurve über die Zahl an der Achse hinaus.
    // Ein Höchstwert von 0 teilte durch null; darum die kleinste Zahl als Boden.
    const top = Math.max(...this.alleJahre(), ...this.laufendesJahr(), Number.EPSILON);
    const point = (i: number, value: number): [number, number] => [
      (i / 51) * breite,
      hoehe - 3 - (value / top) * (hoehe - 8),
    ];
    const alleP = alle.map((value, i) => point(i, value));
    const currentP = current.map((value, i) => point(i, value));
    const last = currentP.at(-1) ?? [0, hoehe];
    return {
      breite,
      hoehe,
      alleJahre: `M0,${hoehe} ${alleP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${breite},${hoehe} Z`,
      currentArea: `M0,${hoehe} ${currentP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${last[0].toFixed(1)},${hoehe} Z`,
      currentLine: `M${currentP.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`,
      hasCurrent: currentP.length > 0,
      badges: MONTH_MARKS.map((k) => (k / 51) * breite),
      endLeft: (last[0] / breite) * 100,
      endTop: (last[1] / hoehe) * 100,
      thin: this.thinWeeks(breite),
    };
  }

  /**
   * Die Monatsmarken auf derselben Skala wie die Kurve: Woche 1 ganz links,
   * Woche 52 ganz rechts. Als Anteil, damit die Marke bei jeder Breite unter
   * ihrer Woche steht.
   */
  protected readonly monthMarks = computed<PlacedMark[]>(() =>
    this.months().map((badge) => ({
      text: badge.text,
      links: ((badge.woche - 1) / 51) * 100,
    })),
  );

  /**
   * Die Wochen, in denen wenigstens eine der beiden Reihen auf wenigen
   * Begehungen ruht. Jede Reihe misst sich an ihrer eigenen stärksten Woche,
   * weil das laufende Jahr naturgemäß weniger Begehungen trägt als zehn Jahre.
   */
  private thinWeeks(breite: number): Strip[] {
    const rows = [this.visitsAllYears(), this.visitsCurrentYearSeries()].filter(
      (series) => series.length > 0,
    );
    if (rows.length === 0) return [];
    const thresholds = rows.map((series) => Math.max(...series) * THIN_BELOW);
    const step = breite / 51;
    const strip: Strip[] = [];
    for (let i = 0; i < Math.max(...rows.map((series) => series.length)); i++) {
      const thin = rows.some((series, r) => i < series.length && series[i] < thresholds[r]);
      if (!thin) continue;
      const x = Math.max(0, (i - 0.5) * step);
      strip.push({ x, breite: Math.min(breite, (i + 0.5) * step) - x });
    }
    return strip;
  }
}
