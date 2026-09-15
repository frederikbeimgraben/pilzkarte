import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die Marken auf der Grundlinie stehen am Anfang der Monate Jan, Mär, … Nov. */
const MONTH_MARKS = [0, 9, 18, 27, 36, 44] as const;

/** Der Anteil des stärksten Wertes, unter dem eine Woche als dünn gilt. */
const THIN_BELOW = 0.25;

/** Zentriertes gleitendes Mittel. Am Rand zählen nur die Nachbarn, die es gibt. */
export function smooth(series: readonly number[], windowSize: number): readonly number[] {
  if (windowSize <= 1) return series;
  const half = Math.floor(windowSize / 2);
  return series.map((_, i) => {
    const first = Math.max(0, i - half);
    const last = Math.min(series.length - 1, i + half);
    let sum = 0;
    for (let k = first; k <= last; k++) sum += series[k];
    return sum / (last - first + 1);
  });
}

let nextNumber = 0;

/** Ein Streifen über einer Woche, die auf wenigen Begehungen ruht. */
interface Strip {
  x: number;
  width: number;
}

/** Eine Monatsmarke unter der Kurve: der Name und die Woche, in der er beginnt. */
export interface MonthMark {
  text: string;
  week: number;
}

/** Die Form einer Reihe: Fläche über alle Jahre, Linie für das laufende Jahr. */
export type SeasonShape = 'area' | 'line';

/** Eine Reihe der Kurve mit ihren Begehungen und ihrer Legende. */
export interface SeasonSeries {
  readonly shape: SeasonShape;
  readonly values: readonly number[];
  /** Begehungen je Kalenderwoche. Wenige Begehungen dünnen die Woche aus. */
  readonly visits?: readonly number[];
  readonly legend?: string;
}

interface Drawing {
  width: number;
  height: number;
  area: string;
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

/** Saisonkurve einer Art: alle Jahre als Fläche, das laufende Jahr als Linie. */
@Component({
  selector: 'app-season-curve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-curve.component.html',
  styleUrl: './season-curve.component.scss',
})
export class SeasonCurveComponent {
  readonly series = input.required<readonly SeasonSeries[]>();
  readonly label = input.required<string>();
  readonly large = input(false);
  /** Die Monatsnamen unter der Grundlinie, jeder auf seiner Woche. */
  readonly months = input<readonly MonthMark[]>([]);
  /** Breite des gleitenden Mittels in Wochen. 1 zeichnet die Rohwerte. */
  readonly smoothing = input(3);
  /** Der Höchstwert der Skala als Text, etwa „32 %“. Leer bleibt er weg. */
  readonly peak = input('');

  protected readonly maskId = `funke-dicht-${nextNumber++}`;
  protected readonly drawing = computed<Drawing>(() => this.compute());

  /** Die Linie steht in der Legende vorn, so wie sie über der Fläche liegt. */
  protected readonly legend = computed<readonly SeasonSeries[]>(() =>
    [...this.series()]
      .filter((row) => row.legend)
      .sort((one, other) => Number(other.shape === 'line') - Number(one.shape === 'line')),
  );

  private values(shape: SeasonShape): readonly number[] {
    return this.series().find((row) => row.shape === shape)?.values ?? [];
  }

  private compute(): Drawing {
    const large = this.large();
    const width = large ? 330 : 88;
    const height = large ? 72 : 36;
    const windowSize = this.smoothing();
    const rawArea = this.values('area');
    const rawLine = this.values('line');
    const area = smooth(rawArea, windowSize);
    const current = smooth(rawLine, windowSize);
    // Der Höchstwert kommt aus den Rohdaten, nicht aus der geglätteten Reihe.
    // Die kleinste Zahl als Boden schützt vor einer Teilung durch null.
    const top = Math.max(...rawArea, ...rawLine, Number.EPSILON);
    const point = (i: number, value: number): [number, number] => [
      (i / 51) * width,
      height - 3 - (value / top) * (height - 8),
    ];
    const areaP = area.map((value, i) => point(i, value));
    const currentP = current.map((value, i) => point(i, value));
    const last = currentP.at(-1) ?? [0, height];
    return {
      width,
      height,
      area: `M0,${height} ${areaP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${width},${height} Z`,
      currentArea: `M0,${height} ${currentP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${last[0].toFixed(1)},${height} Z`,
      currentLine: `M${currentP.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`,
      hasCurrent: currentP.length > 0,
      badges: MONTH_MARKS.map((k) => (k / 51) * width),
      endLeft: (last[0] / width) * 100,
      endTop: (last[1] / height) * 100,
      thin: this.thinWeeks(width),
    };
  }

  /** Die Monatsmarken stehen gleich verteilt unter der Grundlinie. */
  protected readonly monthMarks = computed<readonly MonthMark[]>(() => this.months());

  /** Wochen, in denen eine Reihe auf wenigen Begehungen ruht, je eigener Skala. */
  private thinWeeks(width: number): Strip[] {
    const rows = this.series()
      .map((row) => row.visits ?? [])
      .filter((visits) => visits.length > 0);
    if (rows.length === 0) return [];
    const thresholds = rows.map((series) => Math.max(...series) * THIN_BELOW);
    const step = width / 51;
    const strip: Strip[] = [];
    for (let i = 0; i < Math.max(...rows.map((series) => series.length)); i++) {
      const thin = rows.some((series, r) => i < series.length && series[i] < thresholds[r]);
      if (!thin) continue;
      const x = Math.max(0, (i - 0.5) * step);
      strip.push({ x, width: Math.min(width, (i + 0.5) * step) - x });
    }
    return strip;
  }
}
