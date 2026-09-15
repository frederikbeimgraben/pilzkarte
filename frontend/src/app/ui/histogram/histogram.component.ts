import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
  inside: boolean;
}

/** Verteilung einer Ebene, 40 Klassen. Innerhalb der Bedingung in Primärfarbe. */
@Component({
  selector: 'app-histogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './histogram.component.html',
  styleUrl: './histogram.component.scss',
})
export class HistogramComponent {
  readonly shares = input.required<readonly number[]>();
  readonly label = input.required<string>();
  /** Untere und obere Grenze der Bedingung, Werte zwischen 0 und 1. */
  readonly from = input(0);
  readonly to = input(1);

  protected readonly width = 326;
  protected readonly height = 64;

  protected readonly bars = computed<Bar[]>(() => {
    const shares = this.shares();
    const count = shares.length || 1;
    const top = Math.max(...shares, Number.EPSILON);
    const step = this.width / count;
    return shares.map((value, i) => {
      const height = (value / top) * (this.height - 4);
      const position = i / count;
      return {
        x: position * this.width,
        y: this.height - height,
        width: Math.max(step - 1.5, 0.5),
        height,
        inside: position >= this.from() && position <= this.to(),
      };
    });
  });
}
